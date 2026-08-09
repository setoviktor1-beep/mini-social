# AI composer tools (Phase 3)

Adds optional, provider-backed AI assistance to the post composer and to
the admin moderation queue. Built as a strictly separate module from the
pre-existing Gemini-powered Pro/business AI features (`lib/ai-estimator.ts`,
`app/api/ai/pro-chat`, `app/api/receipts/scan`, `app/api/agent`) — those are
untouched by this work.

## Provider

`lib/ai/openrouter.ts` — a thin OpenRouter client. Model:
`nvidia/nemotron-3-ultra-550b-a55b:free` by default (override with
`OPENROUTER_MODEL`), per the project owner's instruction. **Verified live**
against a real OpenRouter API key: confirmed via `/api/v1/models`, and
`/api/ai/compose` (all six actions) and `/api/ai/moderate` were both
exercised end-to-end through the actual Next.js routes (not just a raw
`curl` to OpenRouter) against an isolated local Postgres/PostgREST stack,
producing correct Lithuanian output and a correctly stored
`moderation_decisions` row.

**This is a reasoning model.** Its responses include internal `reasoning`
tokens that consume the `max_tokens` budget before/alongside the real
`content` — a naive budget sized for "just the answer" can silently
truncate to nothing (`finish_reason: "length"`, empty `content`). Observed
in testing: a simple rewrite task spent 193 of 235 completion tokens on
reasoning; a moderation classification spent 140 of a 150-token budget on
reasoning and left the JSON output truncated mid-object. Both call sites
now budget accordingly (`/api/ai/compose`: 700, `/api/ai/moderate`: 600),
verified sufficient by live testing. `chatCompletion()` also now detects
this failure mode explicitly (`finish_reason === 'length'` with empty
content) and throws a distinct `AiRequestError` rather than a generic one.

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
OPENROUTER_MODEL=            # optional, defaults to nvidia/nemotron-3-ultra-550b-a55b:free
```

No other infrastructure is required — no new external service beyond the
OpenRouter HTTPS API, using the Redis/Postgres this app already depends on
for rate limiting and quotas.
