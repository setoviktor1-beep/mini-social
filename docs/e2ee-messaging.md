# E2EE messaging (Phase 4) — status: adapter boundary only, not integrated

**Current state of the actual messaging feature (`app/messages`): unchanged
and fully operational.** Messages are plain text stored in the `messages`
Postgres table, protected by TLS in transit and standard database access
controls (RLS, `service_role`-only bypass) at rest. **This is not
end-to-end encryption** and this document does not claim it is. Nothing
here changes what `app/messages` does today.

## What this phase adds

A clean adapter boundary (`lib/messaging/`) so a future E2EE backend can be
swapped in without the UI needing to change:

- `lib/messaging/adapter.ts` — the `MessagingAdapter` interface
  (`listConversations`, `getOrCreateConversation`, `listMessages`,
  `sendMessage`, `markRead`) plus `AdapterMessage`/`AdapterConversation`
  types. Every `AdapterMessage` carries `wasEndToEndEncrypted: boolean` so
  a caller can never accidentally treat a plaintext message as encrypted.
- `lib/messaging/legacy-adapter.ts` — a real, working implementation of
  that interface wrapping the current `conversations`/`messages` tables
  and the existing `get_or_create_conversation` RPC. `providesEndToEndEncryption: false`.
- `lib/messaging/matrix-adapter.ts` — **a stub, not an implementation.**
  Every method throws `MatrixNotConfiguredError`. This is intentional: a
  half-working E2EE layer is more dangerous than none, because it invites
  trusting encryption that isn't actually end-to-end. See "Why nothing
  more was built" below.
- `lib/messaging/index.ts` — `getMessagingAdapter()` selects between the
  two based on `NEXT_PUBLIC_E2EE_MESSAGING_ENABLED` (default unset/false).
  **Not called anywhere in the app yet** — `app/messages` still talks to
  the database directly, exactly as before this phase.

## Why nothing more was built

No Matrix homeserver credentials or infrastructure are available in this
environment. Per the project's own constraint ("do not claim current
messages are E2EE until sender-to-recipient encryption, device
verification, and key handling are actually working and tested"),
shipping a `matrix-js-sdk` integration that has never connected to a real
homeserver would be exactly the kind of unverified claim to avoid. The
adapter boundary above is the complete, honest scope for this phase.

## What a real Matrix integration would require

1. **Homeserver.** Either a self-hosted Synapse/Dendrite instance (adds
   real ops burden — backups, federation config or federation-disabled
   mode, TURN server for calls if ever needed) or a managed Matrix hosting
   provider. Decide before writing more code — this is an infrastructure
   decision, not just a library choice.
2. **`matrix-js-sdk`** (or a lighter alternative) for the client, plus a
   server-side bridge/bot user if messages need to originate from
   server-side logic (e.g. system notifications) rather than only
   user-to-user.
3. **Per-device keys and device verification** (SAS/emoji verification or
   QR) — without this, "E2EE" is theater; an unverified device can MITM.
4. **Key backup/recovery** (Matrix's secure key backup, or an equivalent)
   so a user doesn't lose message history on a lost/reset device — and a
   UX for what happens when they don't have it set up.
5. **Multi-device sync** — a user reading messages on phone + desktop
   needs each device to have (or fetch) the room keys.
6. **Lost-device revocation** — signing out a compromised device must stop
   it from decrypting future messages.
7. **Encrypted attachments** — this app's messaging doesn't currently
   support attachments, but if that changes, they need the same
   encryption guarantee as text.
8. **Metadata leakage review.** Matrix federation (if enabled) and even a
   single homeserver still expose participant lists, timestamps, and
   message sizes to the server operator unless specifically mitigated —
   document what is and isn't hidden from the homeserver operator.
9. **Notification privacy.** Push notification payloads must not leak
   plaintext message content for E2EE rooms (standard Matrix push gateways
   handle this, but it must be verified against this app's existing
   `lib/pushNotify.ts`/web-push setup, not assumed).
10. **Migration of existing plaintext messages.** Decide: leave old
    conversations as legacy/unencrypted, force a fresh start, or (much
    harder) attempt a one-time reupload into new encrypted rooms with user
    consent. This needs a product decision, not just an engineering one.
11. **Feature-flag rollout.** Once built, `NEXT_PUBLIC_E2EE_MESSAGING_ENABLED`
    should stay `false` until the above is tested end-to-end (send from
    device A, verify device B can decrypt, verify a third unverified
    device cannot, verify the homeserver operator cannot read plaintext
    from its own database).

## Environment variables

```
NEXT_PUBLIC_E2EE_MESSAGING_ENABLED=false   # keep false until the above is built and tested
```

No Matrix-specific environment variables are defined yet — there is
nothing configured to point them at.
