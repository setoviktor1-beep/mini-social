# Dedicated MiniSocial OpenClaw Production Harness

## 1. Overview & Architecture

MiniSocial utilizes a dedicated, containerized OpenClaw instance as a shared AI agent harness, model orchestrator, and reasoning loop runtime.

```text
Internet
   │
   ▼
Traefik Reverse Proxy (HTTPS)
   │
   ▼
MiniSocial Web / API Container (`mini-social-app`)
Next.js / Better Auth / RLS Authority / Tool Validator
   │
   │ Internal Docker Network (`backend`)
   ▼
MiniSocial OpenClaw Container (`mini-social-openclaw:18789`)
Shared Agent Harness & Multi-User Isolated Session Runtime
   │
   ├─► Outbound Internet (`agent-egress`) ──► OmniRouter / Free AI Providers
   └─► Scoped Tool Calls (Local Server Execution under authenticated user)
```

### Security Authority Division
- **MiniSocial (`app`)**: The ultimate security authority. Responsible for authentication, user sessions, thread ownership verification, RLS enforcement, rate limiting, and tool permission gating.
- **OpenClaw (`mini-social-openclaw`)**: Untrusted agent harness. Runs models, parses user intent, executes reasoning loops, and emits structured tool calls. Has zero direct database credentials (`DATABASE_URL`, `POSTGRES_PASSWORD`, `SUPABASE_SERVICE_ROLE` are withheld).

---

## 2. Containers, Networks & Volumes

| Component | Identifier | Purpose | Security Controls |
| :--- | :--- | :--- | :--- |
| **Container** | `mini-social-openclaw` | Dedicated OpenClaw Agent Gateway | Non-root `node` (UID 1000), `cap_drop: [ALL]`, `no-new-privileges: true`, resource-constrained |
| **Network (Internal)** | `backend` (`internal: true`) | Private inter-container traffic | Connects MiniSocial `app` to OpenClaw without internet exposure |
| **Network (Egress)** | `agent-egress` (bridge) | Outbound LLM API calls | Allows OpenClaw to reach external AI providers without exposing internal DB/Redis |
| **Volume** | `mini-social-openclaw-data` | Persistent agent state | Isolated named volume; no host root, home, or docker socket mounts |

---

## 3. Environment Variables (Configuration Scope)

All secrets are managed server-side via `.env.production` and are never committed to version control.

### MiniSocial Backend (`app`)
- `OPENCLAW_URL`: Internal endpoint for the OpenClaw service (`http://mini-social-openclaw:18789`).
- `OPENCLAW_GATEWAY_TOKEN`: Shared service bearer token between MiniSocial and OpenClaw.
- `AI_OPENCLAW_ENABLED`: Feature flag toggle (`true` / `false`) controlling OpenClaw routing vs legacy fallback.

### OpenClaw Container (`mini-social-openclaw`)
- `OPENCLAW_PORT`: Listening port inside container (`18789`).
- `OPENCLAW_GATEWAY_TOKEN`: Bearer token for authenticating internal gateway requests.
- `OPENCLAW_AI_BASE_URL`: Base URL for OmniRouter / OpenRouter-compatible endpoint.
- `OPENCLAW_AI_API_KEY`: API key for upstream LLM provider routing.
- `OPENCLAW_PRIMARY_MODEL`: Primary free model (`nvidia/nemotron-3-ultra-550b-a55b:free`).
- `OPENCLAW_FALLBACK_MODEL`: Fallback free model (`google/gemini-3.5-flash-lite`).
- `OPENCLAW_GEMMA_MODEL`: Secondary free model (`google/gemma-4-31b-it:free`).

---

## 4. Multi-User Session Isolation

OpenClaw is deployed once and shared among all MiniSocial users while maintaining absolute logical isolation:

1. **Server-Derived Identity**:
   - The browser never supplies a trusted `userId`.
   - MiniSocial derives `userId` strictly from the server-side authenticated session (`createSupabaseServerClient().auth.getUser()`).
2. **Deterministic Session Keys**:
   - Every request is tagged with an isolated session key: `minisocial:<userId>:<threadId>`.
   - OpenClaw isolates context, memory, and session state within this namespace.
3. **Bound Tool Execution**:
   - When OpenClaw emits a tool call (e.g. `get_my_profile`, `get_my_posts`, `create_post`), MiniSocial executes the tool locally using the session's authenticated `userId`.
   - Any foreign `userId` injected in model arguments is ignored.
4. **Output Guard & Defense-in-Depth**:
   - Leaked tool call artifacts (````tool_call ... ````, `<tool_call>`, `<think>`) and internal reasoning tokens are stripped before saving or presenting output to users.
   - Secret leak guards ensure no connection strings or tokens are exposed.

---

## 5. Operations & Healthcheck

### Container Health Check
- Endpoint: `GET /health` on port `18789`.
- Returns: `{"ok":true,"status":"live"}`.

### Startup / Rebuild
```bash
# Build OpenClaw image
docker compose --env-file .env.production build mini-social-openclaw

# Start or restart OpenClaw container
docker compose --env-file .env.production up -d mini-social-openclaw
```

### Inspect Container & Logs
```bash
# Check status and health
docker ps | grep openclaw

# Inspect logs
docker logs --tail=100 -f mini-social-mini-social-openclaw-1
```

---

## 6. Rollback Procedure

If OpenClaw requires immediate rollback:
1. In `.env.production`, set:
   ```env
   AI_OPENCLAW_ENABLED=false
   ```
2. Restart the app service (or hot reload env):
   ```bash
   docker compose --env-file .env.production up -d --no-deps app
   ```
3. MiniSocial will automatically fall back to the internal direct OmniRouter engine without downtime.
