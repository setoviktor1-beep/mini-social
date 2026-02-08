-- ============================================
-- MIGRATION V3: Admin Panel & Audit Logging
-- ============================================

-- =====================
-- 1. AUDIT LOG TABLE
-- =====================

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'suspend_user', 'unsuspend_user', 'change_role',
    'hide_post', 'delete_post', 'restore_post',
    'hide_comment', 'delete_comment', 'restore_comment',
    'hide_discussion', 'delete_discussion', 'restore_discussion',
    'resolve_report', 'close_report', 'assign_report'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'post', 'comment', 'discussion', 'report')),
  target_id UUID NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_moderation_actions_created ON public.moderation_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target ON public.moderation_actions(target_type, target_id);

-- RLS for moderation_actions
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and mods can view moderation actions"
  ON public.moderation_actions FOR SELECT
  USING (public.is_admin_or_mod());

CREATE POLICY "Admins and mods can insert moderation actions"
  ON public.moderation_actions FOR INSERT
  WITH CHECK (public.is_admin_or_mod());

-- =====================
-- 2. REPORTS: assigned_to
-- =====================

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- =====================
-- 3. RLS: Admins/mods can see ALL content (not just active)
-- =====================

-- Posts: admins/mods can see all statuses
CREATE POLICY "Admins view all posts"
  ON public.posts FOR SELECT
  USING (public.is_admin_or_mod());

-- Comments: admins/mods can see all statuses
CREATE POLICY "Admins view all comments"
  ON public.comments FOR SELECT
  USING (public.is_admin_or_mod());

-- Discussions: admins/mods can see all statuses
CREATE POLICY "Admins view all discussions"
  ON public.discussions FOR SELECT
  USING (public.is_admin_or_mod());

-- Discussion replies: admins/mods can see all statuses
CREATE POLICY "Admins view all discussion replies"
  ON public.discussion_replies FOR SELECT
  USING (public.is_admin_or_mod());

-- =====================
-- 4. RLS: Admins can update any profile (role changes, suspension)
-- =====================

CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_admin_or_mod());
