'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X, Home, MessageCircle, User as UserIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import ChatSidebar from '@/components/ai/ChatSidebar'
import ChatWindow from '@/components/ai/ChatWindow'
import ChatInput from '@/components/ai/ChatInput'
import ConversationStarters from '@/components/ai/ConversationStarters'

type Conversation = {
  id: string
  title: string
  updated_at: string
}

type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}
type ChatMode = 'default' | 'ask_anything'

export default function AIChatPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatMode, setChatMode] = useState<ChatMode>('default')

  const loadConversations = async () => {
    const res = await fetch('/api/ai/conversations')
    if (!res.ok) return
    const data = (await res.json()) as Conversation[]
    setConversations(data || [])
  }

  const loadConversation = async (id: string) => {
    const res = await fetch(`/api/ai/conversations/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setActiveConversationId(id)
    setMessages(data?.messages || [])
  }

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .maybeSingle()
      setUserName(profile?.display_name || profile?.username || 'User')

      await loadConversations()
    }
    void init()
  }, [supabase, router])

  const handleNewConversation = () => {
    setActiveConversationId(undefined)
    setMessages([])
    setInput('')
    setChatMode('default')
    setDrawerOpen(false)
  }

  const handleSend = async () => {
    const message = input.trim()
    if (!message || loading) return

    setInput('')
    setLoading(true)
    const temporaryUserMessage: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, temporaryUserMessage])

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: activeConversationId,
        message,
        mode: chatMode,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      const conversationId = data?.conversationId as string
      if (conversationId && conversationId !== activeConversationId) {
        setActiveConversationId(conversationId)
      }
      if (conversationId) {
        await loadConversation(conversationId)
      }
      await loadConversations()
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== temporaryUserMessage.id))
    }

    setLoading(false)
  }

  if (!userId) {
    return <div className="py-10 text-center text-[var(--text-secondary)]">Loading...</div>
  }

  return (
    <div className="min-h-[calc(100vh-110px)] md:min-h-[calc(100vh-90px)] md:-mx-4 flex bg-[var(--bg-primary)] rounded-2xl md:rounded-none overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={(id) => {
          void loadConversation(id)
        }}
        onCreate={handleNewConversation}
        userName={userName}
      />

      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
          <div className="h-full w-[82%] max-w-[300px] bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)]">
            <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border-subtle)]">
              <span className="font-semibold text-[var(--text-primary)]">Conversations</span>
              <button onClick={() => setDrawerOpen(false)} className="text-[var(--text-secondary)]">
                <X size={20} />
              </button>
            </div>
            <div className="p-3">
              <button
                onClick={handleNewConversation}
                className="mb-2 w-full h-10 rounded-full bg-[var(--accent-blue)] text-white text-sm"
              >
                New chat
              </button>
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    void loadConversation(c.id)
                    setDrawerOpen(false)
                  }}
                  className="w-full text-left rounded-md px-3 py-2 mb-1 border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                >
                  <span className="truncate block text-sm">{c.title || 'New conversation'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="mb-2 flex items-center gap-2 md:hidden">
          <button onClick={() => setDrawerOpen(true)} className="h-9 w-9 rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center">
            <Menu size={18} />
          </button>
          <div className="text-sm text-[var(--text-secondary)]">Meta AI Chat</div>
        </div>

        {messages.length === 0 ? (
          <ConversationStarters
            onPick={(key, label) => {
              setChatMode(key === 'ask_anything' ? 'ask_anything' : 'default')
              setInput(label)
            }}
          />
        ) : (
          <ChatWindow messages={messages} loading={loading} />
        )}
        <ChatInput value={input} onChange={setInput} onSend={handleSend} loading={loading} />
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-2">
        <div className="mx-auto max-w-md grid grid-cols-3 gap-2 text-xs">
          <Link href="/" className="h-11 rounded-xl text-[var(--text-secondary)] flex flex-col items-center justify-center gap-1">
            <Home size={16} />
            Feed
          </Link>
          <Link href="/ai-chat" className="h-11 rounded-xl bg-[var(--bg-tertiary)] text-[var(--accent-blue)] flex flex-col items-center justify-center gap-1">
            <MessageCircle size={16} />
            Chat
          </Link>
          <Link href="/settings" className="h-11 rounded-xl text-[var(--text-secondary)] flex flex-col items-center justify-center gap-1">
            <UserIcon size={16} />
            Profile
          </Link>
        </div>
      </nav>
    </div>
  )
}
