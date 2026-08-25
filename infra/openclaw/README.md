# MiniSocial Dedicated OpenClaw Harness

This directory contains the Docker packaging and configuration for the dedicated production OpenClaw agent harness used by MiniSocial.

## Architecture

```text
MiniSocial (Next.js / Web / API)
       |
       | internal Docker network (backend)
       v
MiniSocial OpenClaw container (http://mini-social-openclaw:18789)
       |
       | outbound network (agent-egress)
       v
AI Providers (OmniRouter / Free Models: Nvidia Nemotron, Gemini Flash-Lite, Gemma)
```

## Security Hardening
- **No Privileged Execution**: Runs as non-root `node` user with `cap_drop: [ALL]` and `no-new-privileges: true`.
- **No Host Mounts**: No docker socket (`/var/run/docker.sock`), no host root (`/`), no `/home/viktor`.
- **Isolated Storage**: Dedicated named volume `mini-social-openclaw-data`.
- **Network Isolation**: Exposed strictly within internal Docker network `backend` with outbound access via `agent-egress`. No public port mapping (`0.0.0.0:<port>` is blocked).
- **Logical Multi-Tenancy**: All MiniSocial users share a single OpenClaw harness instance, isolated by deterministic session keys `minisocial:<userId>:<threadId>`.
- **Security Authority**: MiniSocial backend retains full authority over authentication, RLS, authorization, tool validation, and rate limits.
