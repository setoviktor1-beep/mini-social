BEGIN;

-- AI moderation assist: stores the model's opinion on a piece of content
-- for human moderators to act on. This is assistance, not an automated
-- enforcement pipeline — nothing in this schema or the routes that use it
-- hides, removes, or blocks content by itself. A moderator (or the
-- existing `reports`/`moderation_actions` flow) still makes the call.
--
-- model/model_version are stored per decision (not just globally) so a
-- provider or model change doesn't retroactively change the meaning of
-- historical decisions, and so an appeal can be judged against exactly
-- what the model said at the time.
CREATE TABLE IF NOT EXISTS moderation_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  content_id UUID NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('toxicity', 'spam', 'scam', 'harassment', 'other', 'none')),
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'flag', 'block')),
  confidence NUMERIC(4,3),
  rationale TEXT,
  model TEXT NOT NULL,
  model_version TEXT,
  raw_response JSONB,
  -- Human review / appeal state. A decision starts 'pending' review;
  -- a moderator can uphold or overturn it. This is intentionally separate
  -- from `decision` (the model's opinion) so the audit trail preserves
  -- both what the model said and what a human ultimately decided.
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'upheld', 'overturned')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_decisions_content_idx
  ON moderation_decisions(content_type, content_id);
CREATE INDEX IF NOT EXISTS moderation_decisions_author_idx
  ON moderation_decisions(author_id);
CREATE INDEX IF NOT EXISTS moderation_decisions_review_status_idx
  ON moderation_decisions(review_status) WHERE review_status = 'pending';

ALTER TABLE moderation_decisions ENABLE ROW LEVEL SECURITY;

-- Authors can see decisions about their own content (transparency/appeal
-- basis); admins/mods can see and act on everything. No direct INSERT for
-- `authenticated` — decisions are written by the server (service role)
-- after calling the AI provider, never by a client directly.
CREATE POLICY moderation_decisions_read ON moderation_decisions FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY moderation_decisions_review ON moderation_decisions FOR UPDATE TO authenticated
  USING (is_admin_or_mod()) WITH CHECK (is_admin_or_mod());

GRANT SELECT, UPDATE ON public.moderation_decisions TO authenticated;
GRANT ALL ON public.moderation_decisions TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
