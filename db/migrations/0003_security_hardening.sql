BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS working_hours JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'master', 'pro', 'moderator', 'admin'));

CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin_or_mod() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
      OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
      OR NEW.is_pro IS DISTINCT FROM OLD.is_pro
      OR NEW.balance IS DISTINCT FROM OLD.balance
      OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Protected profile fields cannot be changed'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.referred_by IS NOT NULL
      AND NEW.referred_by IS DISTINCT FROM OLD.referred_by
    THEN
      RAISE EXCEPTION 'Referral ownership cannot be changed'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.referred_by = NEW.id THEN
    RAISE EXCEPTION 'A profile cannot refer itself'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_profile_security_fields ON public.profiles;
CREATE TRIGGER protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_security_fields();

CREATE OR REPLACE FUNCTION public.protect_conversation_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
    AND (
      NEW.user1_id IS DISTINCT FROM OLD.user1_id
      OR NEW.user2_id IS DISTINCT FROM OLD.user2_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    )
  THEN
    RAISE EXCEPTION 'Conversation participants cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_conversation_participants ON public.conversations;
CREATE TRIGGER protect_conversation_participants
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_conversation_participants();

CREATE OR REPLACE FUNCTION public.protect_message_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
    AND (
      NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
      OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
      OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    )
  THEN
    RAISE EXCEPTION 'Only message read state can be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_message_identity ON public.messages;
CREATE TRIGGER protect_message_identity
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_message_identity();

CREATE OR REPLACE FUNCTION public.protect_friend_request_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
    AND (
      NEW.sender_id IS DISTINCT FROM OLD.sender_id
      OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    )
  THEN
    RAISE EXCEPTION 'Friend request participants cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_friend_request_participants ON public.friend_requests;
CREATE TRIGGER protect_friend_request_participants
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_friend_request_participants();

CREATE OR REPLACE FUNCTION public.protect_service_request_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
    AND (
      NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.master_id IS DISTINCT FROM OLD.master_id
      OR NEW.pro_id IS DISTINCT FROM OLD.pro_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    )
  THEN
    RAISE EXCEPTION 'Service request participants cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_service_request_participants ON public.service_requests;
CREATE TRIGGER protect_service_request_participants
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_service_request_participants();

CREATE OR REPLACE FUNCTION public.protect_order_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
    AND (
      NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.pro_id IS DISTINCT FROM OLD.pro_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    )
  THEN
    RAISE EXCEPTION 'Order participants cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_order_participants ON public.orders;
CREATE TRIGGER protect_order_participants
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_order_participants();

NOTIFY pgrst, 'reload schema';

COMMIT;
