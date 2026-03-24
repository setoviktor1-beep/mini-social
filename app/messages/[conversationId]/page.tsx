'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'
import MessageBubble from '@/components/MessageBubble'
import Image from 'next/image'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

interface OtherUser {
  id: string
  username: string
  display_name: string
  avatar_path: string | null
}

export default function ChatPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const params = useParams()
  const conversationId = params.conversationId as string

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [blocked, setBlocked] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  const markAsRead = useCallback(async (userId: string) => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false)
  }, [conversationId, supabase])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setCurrentUserId(user.id)

      const { data: convo, error: convoError } = await supabase
        .from('conversations')
        .select(`
          *,
          user1:user1_id(id, username, display_name, avatar_path),
          user2:user2_id(id, username, display_name, avatar_path)
        `)
        .eq('id', conversationId)
        .single()

      if (convoError || !convo) {
        console.error('Conversation not found:', convoError)
        router.push('/messages')
        return
      }

      if (convo.user1_id !== user.id && convo.user2_id !== user.id) {
        router.push('/messages')
        return
      }

      const other = convo.user1_id === user.id ? convo.user2 : convo.user1
      setOtherUser(other as OtherUser)

      const [{ data: blocksByMe }, { data: blocksMe }] = await Promise.all([
        supabase.from('blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', (other as any).id),
        supabase.from('blocks').select('id').eq('blocker_id', (other as any).id).eq('blocked_id', user.id),
      ])
      const isBlocked = !!(blocksByMe && blocksByMe.length) || !!(blocksMe && blocksMe.length)
      setBlocked(isBlocked)

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (messagesError) {
        console.error('Error fetching messages:', messagesError)
      }

      setMessages(messagesData || [])
      setLoading(false)
      scrollToBottom('auto')

      await markAsRead(user.id)

      channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            const newMsg = payload.new as Message
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })

            if (newMsg.sender_id !== user.id) {
              supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', newMsg.id)
                .then()
            }
          }
        )
        .subscribe()
    }

    initialize()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [conversationId, markAsRead, router, scrollToBottom, supabase])

  useEffect(() => {
    scrollToBottom(messages.length > 1 ? 'smooth' : 'auto')
  }, [messages, scrollToBottom])

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUserId || sending || blocked) return

    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)

    const { data: inserted, error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content
    }).select().single()

    if (error || !inserted) {
      console.error('Error sending message:', error)
      setNewMessage(content)
      setSending(false)
      return
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === inserted.id)) return prev
      return [...prev, inserted as Message]
    })
    scrollToBottom('auto')

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-lg">Loading conversation...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden" style={{ height: 'calc(100vh - 7rem)', minHeight: '400px' }}>
      {/* Chat Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
        <Link
          href="/messages"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </Link>
        <Link href={`/u/${otherUser?.username}`} className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
            {otherUser?.avatar_path ? (
              <div className="relative w-full h-full">
                        <Image src={getAvatarUrl(otherUser.avatar_path) || ''} alt="" fill sizes="40px" className="object-cover" unoptimized />
              </div>
            ) : (
              <span className="text-sm font-bold text-blue-300 dark:text-blue-500">
                {otherUser?.display_name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-gray-100 truncate">{otherUser?.display_name}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">@{otherUser?.username}</p>
          </div>
        </Link>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2 sm:space-y-3 bg-gray-50/50 dark:bg-gray-950/50"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3">
              <span className="text-xl font-bold text-blue-300 dark:text-blue-500">
                {otherUser?.display_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">{otherUser?.display_name}</h3>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              This is the beginning of your conversation.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            content={msg.content}
            created_at={msg.created_at}
            isOwn={msg.sender_id === currentUserId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 sm:p-3 flex-shrink-0">
        {blocked && (
          <div className="mb-2 text-xs sm:text-sm bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-300 rounded-2xl px-3 py-2">
            Messaging is disabled because one of you blocked the other.
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 sm:px-4 py-2.5 text-sm sm:text-[15px] outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 resize-none max-h-32 overflow-y-auto dark:text-gray-200 dark:placeholder-gray-500"
            style={{ minHeight: '44px' }}
            disabled={blocked}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = '44px'
              target.style.height = Math.min(target.scrollHeight, 128) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending || blocked}
            className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0 shadow-sm shadow-blue-100 dark:shadow-blue-900/30 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
