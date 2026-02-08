'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ConversationItem {
  id: string
  user1_id: string
  user2_id: string
  last_message_at: string
  created_at: string
  user1: {
    id: string
    username: string
    display_name: string
    avatar_path: string | null
  }
  user2: {
    id: string
    username: string
    display_name: string
    avatar_path: string | null
  }
  lastMessage?: {
    content: string
    sender_id: string
    is_read: boolean
  } | null
  unreadCount: number
}

export default function MessagesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const loadConversations = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setCurrentUserId(user.id)

      // Fetch conversations where user is either user1 or user2
      const { data: convos, error } = await supabase
        .from('conversations')
        .select(`
          *,
          user1:user1_id(id, username, display_name, avatar_path),
          user2:user2_id(id, username, display_name, avatar_path)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (error) {
        console.error('Error fetching conversations:', error)
        setLoading(false)
        return
      }

      // For each conversation, fetch the last message and unread count
      const conversationsWithDetails = await Promise.all(
        (convos || []).map(async (convo: any) => {
          // Get last message
          const { data: lastMessages } = await supabase
            .from('messages')
            .select('content, sender_id, is_read')
            .eq('conversation_id', convo.id)
            .order('created_at', { ascending: false })
            .limit(1)

          // Get unread count (messages from the other user that are unread)
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', convo.id)
            .neq('sender_id', user.id)
            .eq('is_read', false)

          return {
            ...convo,
            lastMessage: lastMessages?.[0] || null,
            unreadCount: unreadCount || 0
          }
        })
      )

      setConversations(conversationsWithDetails)
      setLoading(false)
    }

    loadConversations()
  }, [])

  const getOtherUser = (convo: ConversationItem) => {
    return convo.user1_id === currentUserId ? convo.user2 : convo.user1
  }

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-lg">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={22} className="text-gray-600" />
        </Link>
        <h1 className="text-2xl font-black text-gray-900">Messages</h1>
      </div>

      {/* Conversations list */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {conversations.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-blue-300" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">No messages yet</h3>
            <p className="text-gray-500 text-sm">
              Start a conversation by visiting someone&apos;s profile and tapping Message.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map((convo) => {
              const otherUser = getOtherUser(convo)
              const avatarUrl = getAvatarUrl(otherUser?.avatar_path)
              const hasUnread = convo.unreadCount > 0

              return (
                <button
                  key={convo.id}
                  onClick={() => router.push(`/messages/${convo.id}`)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50/80 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-lg font-bold text-blue-300">
                        {otherUser?.display_name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`font-bold text-gray-900 truncate ${hasUnread ? 'text-gray-900' : ''}`}>
                          {otherUser?.display_name}
                        </span>
                        <span className="text-gray-400 text-sm truncate">
                          @{otherUser?.username}
                        </span>
                      </div>
                      {convo.last_message_at && (
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {formatDistanceToNow(new Date(convo.last_message_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${hasUnread ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                        {convo.lastMessage
                          ? (convo.lastMessage.sender_id === currentUserId ? 'You: ' : '') + convo.lastMessage.content
                          : 'No messages yet'}
                      </p>
                      {hasUnread && (
                        <span className="ml-2 flex-shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
