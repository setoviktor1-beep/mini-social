// Messaging adapter boundary (Phase 4).
//
// This interface exists so the messaging UI can eventually be backed by
// either the current plaintext-over-Postgres implementation or a future
// E2EE (Matrix) implementation without the UI needing to know which one
// it's talking to. It is NOT wired into app/messages yet — see
// docs/e2ee-messaging.md for what's implemented vs. what's still required
// before flipping that switch. Introducing this boundary now, without
// rewiring the (working, tested) existing messaging pages to use it, was
// a deliberate choice: the existing implementation stays exactly as-is
// and fully operational, and this adapter only needs to prove itself
// against a real Matrix homeserver — which this environment does not
// have credentials for yet — before anything starts depending on it.

export type MessageId = string
export type ConversationId = string
export type UserId = string

export interface AdapterMessage {
  id: MessageId
  conversationId: ConversationId
  senderId: UserId
  // Plaintext for the legacy adapter; decrypted plaintext (after local
  // decryption) for an E2EE adapter — callers never see ciphertext.
  content: string
  createdAt: string
  isRead: boolean
  // Only ever true for an adapter that actually performed end-to-end
  // decryption to produce `content`. The legacy adapter must always
  // report `false` here — never claim encryption that didn't happen.
  wasEndToEndEncrypted: boolean
}

export interface AdapterConversation {
  id: ConversationId
  participantIds: UserId[]
  lastMessageAt: string | null
}

export interface MessagingAdapter {
  readonly name: 'legacy-postgres' | 'matrix-e2ee'
  readonly providesEndToEndEncryption: boolean

  listConversations(userId: UserId): Promise<AdapterConversation[]>
  getOrCreateConversation(userId: UserId, otherUserId: UserId): Promise<ConversationId>
  listMessages(conversationId: ConversationId, options?: { before?: string; limit?: number }): Promise<AdapterMessage[]>
  sendMessage(conversationId: ConversationId, senderId: UserId, content: string): Promise<AdapterMessage>
  markRead(conversationId: ConversationId, userId: UserId): Promise<void>
}

export function isE2eeMessagingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_E2EE_MESSAGING_ENABLED === 'true'
}
