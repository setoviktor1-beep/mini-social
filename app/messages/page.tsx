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

      const [{ data: blocksByMe }, { data: blocksMe }] = await Promise.all([
        supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
        supabase.from('blocks').select('blocker_id').eq('blocked_id', user.id),
      ])
      const blockedIds = new Set<string>([
        ...(blocksByMe || []).map((r: any) => r.blocked_id),
        ...(blocksMe || []).map((r: any) => r.blocker_id),
      ].filter(Boolean))

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

      const visibleConvos = (convos || []).filter((convo: any) => {
        const otherId = convo.user1_id === user.id ? convo.user2_id : convo.user1_id
        return !blockedIds.has(otherId)
      })

      const conversationsWithDetails = await Promise.all(
        visibleConvos.map(async (convo: any) => {
          const { data: lastMessages } = await supabase
            .from('messages')
            .select('content, sender_id, is_read')
            .eq('conversation_id', convo.id)
            .order('created_at', { ascending: false })
            .limit(1)

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
        <div className="text-gray-400 dark:text-gray-500 text-base sm:text-lg">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ArrowLeft size={22} className="text-gray-600 dark:text-gray-400" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">Messages</h1>
      </div>

      {/* Conversations list */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        {conversations.length === 0 ? (
          <div className="p-10 sm:p-16 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-blue-300 dark:text-blue-500" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base sm:text-lg mb-1">No messages yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Start a conversation by visiting someone&apos;s profile and tapping Message.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {conversations.map((convo) => {
              const otherUser = getOtherUser(convo)
              const avatarUrl = getAvatarUrl(otherUser?.avatar_path)
              const hasUnread = convo.unreadCount > 0

              return (
                <button
                  key={convo.id}
                  onClick={() => router.push(`/messages/${convo.id}`)}
                  className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-colors text-left min-h-[72px]"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-base sm:text-lg font-bold text-blue-300 dark:text-blue-500">
                        {otherUser?.display_name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                        <span className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm sm:text-base">
                          {otherUser?.display_name}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm truncate hidden sm:inline">
                          @{otherUser?.username}
                        </span>
                      </div>
                      {convo.last_message_at && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
                          {formatDistanceToNow(new Date(convo.last_message_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs sm:text-sm truncate ${hasUnread ? 'text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
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
