'use client'

import { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'

type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

type ChatWindowProps = {
  messages: Message[]
  loading?: boolean
}

export default function ChatWindow({ messages, loading = false }: ChatWindowProps) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="flex-1 overflow-y-auto space-y-3 px-1 sm:px-2">
      {messages
        .filter((m) => m.role !== 'system')
        .map((m) => (
          <ChatMessage key={m.id} role={m.role === 'assistant' ? 'assistant' : 'user'} content={m.content} createdAt={m.created_at} />
        ))}

      {loading && (
        <div className="flex items-center gap-1 pl-10 text-[var(--accent-blue)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:0.1s]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-current [animation-delay:0.2s]" />
        </div>
      )}

      <div ref={endRef} />
    </div>
  )
}
