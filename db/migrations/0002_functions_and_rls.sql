BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin_or_mod()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  first_user UUID;
  second_user UUID;
  conversation_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF uid = other_user_id THEN RAISE EXCEPTION 'Cannot message yourself'; END IF;
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = uid AND blocked_id = other_user_id)
       OR (blocker_id = other_user_id AND blocked_id = uid)
  ) THEN
    RAISE EXCEPTION 'User is blocked';
  END IF;

  first_user := LEAST(uid, other_user_id);
  second_user := GREATEST(uid, other_user_id);
  INSERT INTO conversations (user1_id, user2_id)
  VALUES (first_user, second_user)
  ON CONFLICT (user1_id, user2_id)
  DO UPDATE SET user1_id = EXCLUDED.user1_id
  RETURNING id INTO conversation_id;
  RETURN conversation_id;
END
$$;

CREATE OR REPLACE FUNCTION public.update_profile_location(
  user_id UUID,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF lat NOT BETWEEN -90 AND 90 OR lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;
  UPDATE profiles
  SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326),
      address_lat = lat,
      address_lng = lng
  WHERE id = user_id;
END
$$;

CREATE OR REPLACE FUNCTION public.get_nearby_post_ids(
  p_user_id UUID,
  p_radius_km NUMERIC
)
RETURNS TABLE(post_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM posts p
  JOIN profiles author ON author.id = p.user_id
  JOIN profiles viewer ON viewer.id = p_user_id
  WHERE p.status = 'active'
    AND viewer.location IS NOT NULL
    AND author.location IS NOT NULL
    AND ST_DWithin(
      author.location::geography,
      viewer.location::geography,
      LEAST(GREATEST(p_radius_km, 0), 200) * 1000
    )
$$;

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_user_id UUID,
  p_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  current_count INTEGER;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO ai_usage(user_id, month, count)
  VALUES (p_user_id, current_month, 0)
  ON CONFLICT (user_id, month) DO NOTHING;
  SELECT count INTO current_count
  FROM ai_usage
  WHERE user_id = p_user_id AND month = current_month
  FOR UPDATE;
  IF current_count >= p_limit THEN RETURN false; END IF;
  UPDATE ai_usage
  SET count = count + 1, updated_at = now()
  WHERE user_id = p_user_id AND month = current_month;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.charge_ai_usage(
  p_user_id UUID,
  p_feature TEXT,
  p_model TEXT,
  p_tokens_in INTEGER,
  p_tokens_out INTEGER,
  p_cost NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance NUMERIC(10,2);
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF p_cost < 0 THEN RAISE EXCEPTION 'Invalid cost'; END IF;
  IF (
    SELECT count(*) FROM usage_logs
    WHERE user_id = p_user_id AND created_at > now() - interval '1 minute'
  ) >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;
  UPDATE profiles
  SET balance = balance - p_cost
  WHERE id = p_user_id AND balance >= p_cost
  RETURNING balance INTO new_balance;
  IF new_balance IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  INSERT INTO usage_logs(
    user_id, feature, model, tokens_input, tokens_output, cost
  ) VALUES (
    p_user_id, p_feature, p_model,
    GREATEST(p_tokens_in, 0), GREATEST(p_tokens_out, 0), p_cost
  );
  RETURN new_balance;
END
$$;

CREATE OR REPLACE FUNCTION public.credit_wallet_and_complete_transaction(
  p_user_id UUID,
  p_amount NUMERIC,
  p_stripe_session_id TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  transaction_status TEXT;
  new_balance NUMERIC(10,2);
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT status INTO transaction_status
  FROM wallet_transactions
  WHERE stripe_session_id = p_stripe_session_id
  FOR UPDATE;
  IF transaction_status IS NULL THEN
    RAISE EXCEPTION 'WALLET_TRANSACTION_NOT_FOUND';
  END IF;
  IF transaction_status <> 'completed' THEN
    UPDATE profiles SET balance = balance + p_amount
    WHERE id = p_user_id RETURNING balance INTO new_balance;
    UPDATE wallet_transactions
    SET status = 'completed', credited_at = now(), updated_at = now()
    WHERE stripe_session_id = p_stripe_session_id;
  ELSE
    SELECT balance INTO new_balance FROM profiles WHERE id = p_user_id;
  END IF;
  RETURN new_balance;
END
$$;

CREATE OR REPLACE FUNCTION public.prevent_privilege_or_owner_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin_or_mod() THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'profiles' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role_update_forbidden';
  END IF;
  IF TG_TABLE_NAME = 'service_requests'
    AND (NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.master_id IS DISTINCT FROM OLD.master_id
      OR NEW.pro_id IS DISTINCT FROM OLD.pro_id) THEN
    RAISE EXCEPTION 'ownership_update_forbidden';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER profiles_protect_privileges
  BEFORE UPDATE ON profiles FOR EACH ROW
  EXECUTE FUNCTION prevent_privilege_or_owner_change();
CREATE TRIGGER service_requests_protect_owners
  BEFORE UPDATE ON service_requests FOR EACH ROW
  EXECUTE FUNCTION prevent_privilege_or_owner_change();

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles','posts','post_media','likes','comments','follows','reports',
    'discussions','discussion_replies','conversations','messages',
    'notifications','blocks','reposts','friend_requests','moderation_actions',
    'service_requests','orders','pro_services','calendar_events',
    'quick_reply_templates','subscriptions','billing_checkout_sessions',
    'wallet_transactions','processed_events','usage_logs','ai_conversations',
    'ai_messages','ai_memory','ai_usage','receipts','financial_settings',
    'monthly_income','push_subscriptions','maps_cache','agent_config',
    'agent_messages','agent_trigger_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
  END LOOP;
END
$$;

GRANT SELECT ON profiles, posts, post_media, likes, comments, follows,
  discussions, discussion_replies, reposts, pro_services
  TO anonymous;
GRANT USAGE ON SCHEMA public TO anonymous, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID),
  public.update_profile_location(UUID, DOUBLE PRECISION, DOUBLE PRECISION),
  public.get_nearby_post_ids(UUID, NUMERIC),
  public.check_and_increment_ai_usage(UUID, INTEGER),
  public.charge_ai_usage(UUID, TEXT, TEXT, INTEGER, INTEGER, NUMERIC)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_and_complete_transaction(UUID, NUMERIC, TEXT)
  TO service_role;

CREATE POLICY profiles_read ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_self_update ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE TO authenticated
  USING (is_admin_or_mod()) WITH CHECK (is_admin_or_mod());

CREATE POLICY posts_read ON posts FOR SELECT
  USING (status = 'active' OR user_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY posts_insert ON posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY posts_update ON posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY posts_delete ON posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod());

CREATE POLICY post_media_read ON post_media FOR SELECT USING (true);
CREATE POLICY post_media_owner ON post_media FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY likes_read ON likes FOR SELECT USING (true);
CREATE POLICY likes_owner ON likes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY comments_read ON comments FOR SELECT
  USING (status = 'active' OR user_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY comments_owner ON comments FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod())
  WITH CHECK (user_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY follows_read ON follows FOR SELECT USING (true);
CREATE POLICY follows_owner ON follows FOR ALL TO authenticated
  USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());
CREATE POLICY reposts_read ON reposts FOR SELECT USING (true);
CREATE POLICY reposts_owner ON reposts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY reports_insert ON reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY reports_read ON reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY reports_admin_update ON reports FOR UPDATE TO authenticated
  USING (is_admin_or_mod());
CREATE POLICY moderation_admin ON moderation_actions FOR ALL TO authenticated
  USING (is_admin_or_mod()) WITH CHECK (is_admin_or_mod());

CREATE POLICY discussions_read ON discussions FOR SELECT
  USING (status = 'active' OR user_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY discussions_owner ON discussions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod())
  WITH CHECK (user_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY replies_read ON discussion_replies FOR SELECT
  USING (status = 'active' OR user_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY replies_owner ON discussion_replies FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod())
  WITH CHECK (user_id = auth.uid() OR is_admin_or_mod());

CREATE POLICY conversations_member ON conversations FOR ALL TO authenticated
  USING (auth.uid() IN (user1_id, user2_id))
  WITH CHECK (auth.uid() IN (user1_id, user2_id));
CREATE POLICY messages_member ON messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id AND auth.uid() IN (c.user1_id, c.user2_id)
  ));
CREATE POLICY messages_send ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND auth.uid() IN (c.user1_id, c.user2_id)
    )
  );
CREATE POLICY messages_member_update ON messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id AND auth.uid() IN (c.user1_id, c.user2_id)
  ));

CREATE POLICY notifications_owner_read ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notifications_actor_insert ON notifications FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE POLICY notifications_owner_update ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY blocks_visible ON blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid());
CREATE POLICY blocks_owner ON blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());
CREATE POLICY friend_requests_member ON friend_requests FOR ALL TO authenticated
  USING (auth.uid() IN (sender_id, receiver_id))
  WITH CHECK (auth.uid() IN (sender_id, receiver_id));

CREATE POLICY service_requests_member ON service_requests FOR SELECT TO authenticated
  USING (auth.uid() IN (client_id, master_id, pro_id));
CREATE POLICY service_requests_insert ON service_requests FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());
CREATE POLICY service_requests_update ON service_requests FOR UPDATE TO authenticated
  USING (auth.uid() IN (client_id, master_id, pro_id));
CREATE POLICY orders_member ON orders FOR ALL TO authenticated
  USING (auth.uid() IN (client_id, pro_id))
  WITH CHECK (auth.uid() IN (client_id, pro_id));
CREATE POLICY pro_services_read ON pro_services FOR SELECT USING (is_active OR pro_id = auth.uid());
CREATE POLICY pro_services_owner ON pro_services FOR ALL TO authenticated
  USING (pro_id = auth.uid()) WITH CHECK (pro_id = auth.uid());
CREATE POLICY calendar_owner ON calendar_events FOR ALL TO authenticated
  USING (pro_id = auth.uid()) WITH CHECK (pro_id = auth.uid());
CREATE POLICY quick_replies_owner ON quick_reply_templates FOR ALL TO authenticated
  USING (pro_id = auth.uid()) WITH CHECK (pro_id = auth.uid());

CREATE POLICY subscriptions_owner ON subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY checkout_owner ON billing_checkout_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY wallet_owner ON wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY usage_owner ON usage_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY ai_conversations_owner ON ai_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_messages_owner ON ai_messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM ai_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));
CREATE POLICY ai_memory_owner ON ai_memory FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_usage_owner ON ai_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY receipts_owner ON receipts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY financial_settings_owner ON financial_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY monthly_income_owner ON monthly_income FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY push_subscriptions_owner ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY agent_config_owner ON agent_config FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY agent_messages_owner ON agent_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY agent_trigger_owner ON agent_trigger_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
COMMIT;
