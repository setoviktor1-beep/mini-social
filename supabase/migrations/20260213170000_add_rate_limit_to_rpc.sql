-- Add SQL-level rate limiting inside charge_ai_usage transaction
CREATE OR REPLACE FUNCTION public.charge_ai_usage(
  p_user_id UUID,
  p_feature TEXT,
  p_model TEXT,
  p_tokens_in INT,
  p_tokens_out INT,
  p_cost NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC(10,2);
  v_new_balance NUMERIC(10,2);
  recent_count INTEGER;
BEGIN
  IF p_cost < 0 THEN
    RAISE EXCEPTION 'Invalid cost';
  END IF;

  IF p_feature NOT IN ('improve_post', 'generate_reply', 'toxicity_gate', 'chat') THEN
    RAISE EXCEPTION 'Invalid feature';
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.usage_logs
  WHERE user_id = p_user_id
    AND created_at > now() - interval '1 minute';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: % requests in last minute', recent_count;
  END IF;

  SELECT balance
    INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_balance < p_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE public.profiles
  SET balance = balance - p_cost
  WHERE id = p_user_id;

  INSERT INTO public.usage_logs (user_id, feature, model, tokens_input, tokens_output, cost)
  VALUES (p_user_id, p_feature, p_model, GREATEST(p_tokens_in, 0), GREATEST(p_tokens_out, 0), p_cost);

  SELECT balance INTO v_new_balance
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
