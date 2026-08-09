// Messaging adapter selector. Not currently imported by app/messages
// (which still talks to conversations/messages directly) — this exists so
// a future migration of the UI to the adapter boundary has a single,
// obvious entry point. See docs/e2ee-messaging.md.

import { isE2eeMessagingEnabled } from './adapter'
import type { MessagingAdapter } from './adapter'
import { legacyAdapter } from './legacy-adapter'
import { matrixAdapter } from './matrix-adapter'

export function getMessagingAdapter(): MessagingAdapter {
  return isE2eeMessagingEnabled() ? matrixAdapter : legacyAdapter
}

export type { MessagingAdapter, AdapterMessage, AdapterConversation, MessageId, ConversationId, UserId } from './adapter'
export { isE2eeMessagingEnabled } from './adapter'
