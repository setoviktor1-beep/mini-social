# AI composer tools (Phase 3)

Adds optional, provider-backed AI assistance to the post composer and to
the admin moderation queue. Built as a strictly separate module from the
pre-existing Gemini-powered Pro/business AI features (`lib/ai-estimator.ts`,
`app/api/ai/pro-chat`, `app/api/receipts/scan`, `app/api/agent`) — those are
untouched by this work.

## Provider

`lib/ai/openrouter.ts` — a thin OpenRouter client. Model:
`nvidia/nemotron-3-ultra-550b-a50b:free` by default (override with
`OPENROUTER_MODEL`), per the project owner's instruction. **This slug has
not been verified against a live OpenRouter API key** — no key has been
provided to this environment yet. Confirm the model resolves (a simple
`curl` to `/api/v1/chat/completions` with a real key) before treating this
as production-ready; if the slug is wrong you'll get a clean 4xx from
OpenRouter, not a silent failure, since `chatCompletion()` surfaces
non-2xx responses as `AiRequestError`.

## What's implemented

- **`app/api/ai/compose`** (`POST`, authenticated): rewrite, tone
  adjustment, translation, spelling/grammar fix, hashtag suggestions.
  Returns a suggestion string only — never writes to `posts` itself.
- **Composer UI** (`components/PostComposer.tsx`): an "AI pagalba" panel
  with one button per action. A suggestion always renders in a preview box
  with **Naudoti** (apply) / **Atmesti** (discard) — applying only happens
  on that explicit click, never automatically, and never while the user
  isn't looking at it.
- **`app/api/ai/moderate`** (`POST`, admin/moderator only): given a
  reported post/comment, asks the model to classify it
  (`category`/`decision`/`confidence`/`rationale`) and stores the result
  in `moderation_decisions` (`db/migrations/0009_ai_moderation.sql`) along
  with the exact model name/version used. Surfaced in
  `app/admin/reports` as an "✨ Paklausti AI" button next to each expanded
  report — the AI opinion is displayed, but Hide/Delete/Resolve/Close
  remain the only actions that actually change anything. A human always
  decides.
- **Fallback behavior**: `isAiConfigured()` gates every route — if
  `OPENROUTER_API_KEY` is unset, both endpoints return `503 AI_UNAVAILABLE`
  immediately (no attempted network call), and the composer/reports UI
  show a plain error message rather than crashing or hanging. The rest of
  the app (posting, feed, moderation actions) is completely unaffected
  either way.
- **Quotas**: reuses the existing `check_and_increment_ai_usage` RPC and
  `ai_usage` table (the same mechanism the Gemini Pro-chat feature uses) —
  60 composer-AI calls/user/month by default. Moderation-assist calls are
  gated by admin/moderator role instead (not a per-user content quota,
  since it's an internal tool, not user-facing).
- **Rate limiting**: `lib/rate-limit.ts` (Redis-backed, in-memory
  fallback) — 20 req/min on `/api/ai/compose`, 30 req/min on
  `/api/ai/moderate`.
- **Timeouts**: 20s per OpenRouter request (`AbortController`), surfaced
  as a clean `AiRequestError` rather than a hung request.
- **Prompt-injection defense (best-effort, not a guarantee)**: user text
  is always sent as a `user` message, never concatenated into the system
  prompt; the system prompt explicitly instructs the model to treat the
  user content as data, not instructions, and to ignore any embedded
  attempt to override its classification. Input is capped (6000 chars in
  the provider client, 2000 in `/api/ai/compose` matching the post length
  limit). None of this lets untrusted model output execute code, run a
  privileged mutation, or bypass the explicit-confirmation requirement
  above — the model can only ever produce text that a human then chooses
  to apply or ignore.
- **Audit trail**: every moderation decision stores `model`,
  `model_version`, the raw response, who requested it (`requested_by`),
  and a separate human `review_status` (`pending`/`upheld`/`overturned`)
  distinct from the model's own `decision` — see the migration for the
  full schema and RLS (authors can see decisions about their own content;
  admins/mods can see and update all).

## What's explicitly NOT implemented (do not treat as done)

- **Accessible image alt-text generation.** Requires a vision-capable
  model; the configured free-tier Nemotron model is very likely text-only.
  No endpoint exists for this yet.
- **Automatic pre-publish moderation.** `/api/ai/moderate` is
  admin-triggered from the reports queue, not wired into
  `PostComposer.tsx`'s submit path. Posts are not automatically scanned,
  flagged, or blocked on creation. This was a deliberate scope decision to
  avoid adding a synchronous AI call (with its own latency/availability
  risk) to the hot post-creation path in this checkpoint — worth a
  follow-up once the provider is verified working in production.
- **Semantic search / explainable content recommendations.** Not started;
  this needs an embeddings pipeline and vector storage, a materially
  larger scope than the rest of Phase 3.
- **Thread/discussion summaries.** The `/api/ai/compose` endpoint accepts
  a `summarize` action and has a system prompt for it, but no UI calls it
  yet (no "summarize this thread" button exists anywhere).
- **Content labeling for AI-assisted posts.** There is no `posts` column
  marking a post as AI-drafted/AI-edited, and the composer doesn't tag
  published content this way. The "never publish automatically, always
  require confirmation" requirement is met (see above); the separate
  "clearly label AI-generated content in the UI after publishing"
  requirement is not.

## Required environment variables

```
OPENROUTER_API_KEY=          # unset = AI tools cleanly disabled everywhere
OPENROUTER_MODEL=            # optional, defaults to nvidia/nemotron-3-ultra-550b-a50b:free
```

No other infrastructure is required — no new external service beyond the
OpenRouter HTTPS API, using the Redis/Postgres this app already depends on
for rate limiting and quotas.
