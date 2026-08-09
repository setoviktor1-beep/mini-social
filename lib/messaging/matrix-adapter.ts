// Matrix E2EE messaging adapter — NOT IMPLEMENTED.
//
// This file exists to make the intended integration point explicit and to
// fail loudly (rather than silently pretending to work) if something
// tries to use it before it's actually built. See docs/e2ee-messaging.md
// for the full requirements list (homeserver, matrix-js-sdk, per-device
// keys, device verification, key backup, attachment encryption, metadata
// leakage review, migration-of-existing-messages plan) — none of that
// work has started. Do not remove this stub in favor of a "quick"
// implementation without also completing and testing that list; a
// half-working E2EE layer is worse than none, because it invites trusting
// encryption that isn't actually happening end-to-end.
//
// Current status: `NEXT_PUBLIC_E2EE_MESSAGING_ENABLED` defaults to
// unset/false and nothing in the app reads it yet except this file's own
// guard. There is no code path in app/messages that can reach this
// adapter today.

import type { MessagingAdapter } from './adapter'

export class MatrixNotConfiguredError extends Error {
  constructor() {
    super(
      'Matrix E2EE messaging is not implemented in this build. It requires a ' +
      'configured Matrix homeserver, matrix-js-sdk integration, device key ' +
      'management, and a tested migration path — see docs/e2ee-messaging.md. ' +
      'The legacy messaging adapter remains the only supported path.',
    )
    this.name = 'MatrixNotConfiguredError'
  }
}

function unimplemented(): never {
  throw new MatrixNotConfiguredError()
}

// Intentionally implements MessagingAdapter's shape (so the type system
// catches the day this gets built for real) while every method throws.
export const matrixAdapter: MessagingAdapter = {
  name: 'matrix-e2ee',
  providesEndToEndEncryption: true,
  listConversations: async () => unimplemented(),
  getOrCreateConversation: async () => unimplemented(),
  listMessages: async () => unimplemented(),
  sendMessage: async () => unimplemented(),
  markRead: async () => unimplemented(),
}
