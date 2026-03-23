# Asmenys API Security Audit

Scope:
- `middleware.ts`
- `app/api/push/`
- `app/api/services/`
- `app/api/estimate/`

Date:
- 2026-03-23

Method:
- Static review focused on auth bypass, endpoint spam/rate-limit gaps, and data leakage.

## Findings

### 1. Unauthenticated AI estimation endpoint allows anonymous cost exhaustion
- Severity: High
- File: [app/api/estimate/route.ts](/root/Documents/projektai/mini-social/app/api/estimate/route.ts#L23)

`POST /api/estimate` accepts any request, performs no session check, and has no rate limit before calling Gemini at [app/api/estimate/route.ts:32](/root/Documents/projektai/mini-social/app/api/estimate/route.ts#L32) and [app/api/estimate/route.ts:35](/root/Documents/projektai/mini-social/app/api/estimate/route.ts#L35).

Impact:
- Any anonymous client can script unlimited requests and burn paid LLM quota.
- This is a direct public spam surface because `middleware.ts` only protects selected page routes and does not enforce API auth for `/api/estimate`; see [middleware.ts:52](/root/Documents/projektai/mini-social/middleware.ts#L52).

Recommended fix:
- Require authenticated users for this endpoint unless anonymous access is a hard product requirement.
- Add per-IP and per-user rate limits.
- Enforce request body size and input length caps before sending prompts upstream.

### 2. Unauthenticated Google Places proxy can be abused to drain third-party API quota
- Severity: High
- File: [app/api/services/route.ts](/root/Documents/projektai/mini-social/app/api/services/route.ts#L17)

`GET /api/services` is publicly callable, does not verify user identity, and has no rate limiting. On cache miss it forwards requests to Google Places with a server-side API key at [app/api/services/route.ts:59](/root/Documents/projektai/mini-social/app/api/services/route.ts#L59).

Impact:
- Any internet user can turn this route into an unauthenticated proxy to consume Google Maps quota.
- Because the cache key is based on user-controlled `lat`, `lng`, `category`, and `radius` at [app/api/services/route.ts:39](/root/Documents/projektai/mini-social/app/api/services/route.ts#L39), an attacker can vary inputs to force misses and maximize external spend.
- `middleware.ts` does not close this gap because API routes are not included in `isProtectedUserRoute`; see [middleware.ts:52](/root/Documents/projektai/mini-social/middleware.ts#L52).

Recommended fix:
- Require auth or a dedicated signed server-to-server token.
- Add per-IP and per-user throttling.
- Strictly allowlist `category`, validate coordinates, and reject malformed values before reaching Google.

### 3. Authenticated users can amplify push-notification traffic without any abuse controls
- Severity: Medium
- Files:
- [app/api/push/subscribe/route.ts](/root/Documents/projektai/mini-social/app/api/push/subscribe/route.ts#L4)
- [app/api/push/notify/route.ts](/root/Documents/projektai/mini-social/app/api/push/notify/route.ts#L5)

Both push endpoints require a session, but neither has any rate limit, quota, or cardinality control.

Evidence:
- `POST /api/push/subscribe` lets a logged-in user upsert arbitrary endpoints for their account at [app/api/push/subscribe/route.ts:32](/root/Documents/projektai/mini-social/app/api/push/subscribe/route.ts#L32).
- `POST /api/push/notify` lets the same user send a push to every stored subscription for that account at [app/api/push/notify/route.ts:49](/root/Documents/projektai/mini-social/app/api/push/notify/route.ts#L49).

Impact:
- A low-cost attacker can register many bogus endpoints on one account, then repeatedly call `/api/push/notify` to trigger large batches of outbound web-push requests.
- This creates an internal amplification path: one authenticated request fans out to many external requests.

Recommended fix:
- Add per-user rate limits to both endpoints.
- Cap the number of subscriptions per user.
- Prune invalid endpoints aggressively when push delivery fails.
- Consider restricting `/api/push/notify` to trusted server-side callers if end users do not need direct access.

### 4. Multiple endpoints return raw internal/upstream error messages to clients
- Severity: Medium
- Files:
- [app/api/services/route.ts](/root/Documents/projektai/mini-social/app/api/services/route.ts#L98)
- [app/api/estimate/route.ts](/root/Documents/projektai/mini-social/app/api/estimate/route.ts#L52)
- [app/api/push/subscribe/route.ts](/root/Documents/projektai/mini-social/app/api/push/subscribe/route.ts#L41)
- [app/api/push/notify/route.ts](/root/Documents/projektai/mini-social/app/api/push/notify/route.ts#L40)
- [app/api/push/send/route.ts](/root/Documents/projektai/mini-social/app/api/push/send/route.ts#L38)

These handlers reflect `error.message` values back to callers.

Impact:
- Upstream provider responses, database errors, schema details, and internal integration failures may be exposed to untrusted clients.
- This materially helps attackers tune abuse attempts and enumerate backend behavior.

Recommended fix:
- Return generic client-facing errors.
- Log detailed provider/database failures server-side only.
- Standardize error handling so unauthenticated or public callers never receive raw backend messages.

## No Auth Bypass Found

I did not find a direct cross-user auth bypass in:
- [app/api/push/subscribe/route.ts](/root/Documents/projektai/mini-social/app/api/push/subscribe/route.ts)
- [app/api/push/notify/route.ts](/root/Documents/projektai/mini-social/app/api/push/notify/route.ts)
- [app/api/push/send/route.ts](/root/Documents/projektai/mini-social/app/api/push/send/route.ts)

`/api/push/notify` correctly binds `userId` to the authenticated session at [app/api/push/notify/route.ts:22](/root/Documents/projektai/mini-social/app/api/push/notify/route.ts#L22), and `/api/push/send` is guarded by a bearer check against the server secret at [app/api/push/send/route.ts:7](/root/Documents/projektai/mini-social/app/api/push/send/route.ts#L7).

## Residual Risk

The highest-risk issue in this scope is not a classic auth bypass. It is public or weakly controlled access to paid upstream services and outbound notification infrastructure. Under a zero-bugs policy, the unauthenticated `/api/estimate` and `/api/services` routes should be treated as release-blocking until abuse controls are added.
