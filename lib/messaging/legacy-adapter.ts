// Legacy (current, production) messaging adapter: wraps the existing
// `conversations`/`messages` tables behind the MessagingAdapter interface.
// This is NOT wired into app/messages yet (see adapter.ts) — it exists so
// the interface is proven against a real, already-working implementation,
// and so a future caller has a drop-in default. Messages here are plain
// text in Postgres, protected by TLS in transit and RLS/at-rest database
// encryption — this is standard application security, not end-to-end
// encryption. `providesEndToEndEncryption` is `false` and every message
// reports `wasEndToEndEncrypted: false` accordingly; never claim otherwise.

import { createServerClient } from '@/lib/backend-server'
import type {
  AdapterConversation,
  AdapterMessage,
  ConversationId,
  MessagingAdapter,
  UserId,
} from './adapter'

export const legacyAdapter: MessagingAdapter = {
  name: 'legacy-postgres',
  providesEndToEndEncryption: false,

  async listConversations(userId: UserId): Promise<AdapterConversation[]> {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('conversations')
      .select('id, user1_id, user2_id, last_message_at')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false })

    return (data || []).map((row: any) => ({
      id: row.id,
      participantIds: [row.user1_id, row.user2_id],
      lastMessageAt: row.last_message_at,
    }))
  },

  async getOrCreateConversation(userId: UserId, otherUserId: UserId): Promise<ConversationId> {
    const supabase = createServerClient()
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      other_user_id: otherUserId,
    })
    if (error || !data) {
      throw new Error(error?.message || 'Failed to get or create conversation')
    }
    return data as ConversationId
  },

  async listMessages(conversationId: ConversationId, options?: { before?: string; limit?: number }): Promise<AdapterMessage[]> {
    const supabase = createServerClient()
    let query = supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, is_read, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 50)

    if (options?.before) {
      query = query.lt('created_at', options.before)
    }

    const { data } = await query
    return (data || [])
      .map((row: any) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        content: row.content,
        createdAt: row.created_at,
        isRead: row.is_read,
        wasEndToEndEncrypted: false,
      }))
      .reverse()
  },

  async sendMessage(conversationId: ConversationId, senderId: UserId, content: string): Promise<AdapterMessage> {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, content })
      .select('id, conversation_id, sender_id, content, is_read, created_at')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Failed to send message')
    }

    return {
      id: data.id,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      content: data.content,
      createdAt: data.created_at,
      isRead: data.is_read,
      wasEndToEndEncrypted: false,
    }
  },

  async markRead(conversationId: ConversationId, userId: UserId): Promise<void> {
    const supabase = createServerClient()
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false)
  },
}
