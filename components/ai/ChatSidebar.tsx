'use client'

import Link from 'next/link'
import { Home, MessageCircle, User as UserIcon, Plus } from 'lucide-react'

type Conversation = {
  id: string
  title: string
  updated_at: string
}

type ChatSidebarProps = {
  conversations: Conversation[]
  activeConversationId?: string
  onSelect: (id: string) => void
  onCreate: () => void
  userName?: string
}

export default function ChatSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onCreate,
  userName,
}: ChatSidebarProps) {
  return (
    <aside className="hidden md:flex w-[var(--sidebar-width)] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <div className="px-4 py-4 border-b border-[var(--border-subtle)]">
        <div className="text-lg font-semibold text-[var(--text-primary)]">MiniSocial AI</div>
      </div>

      <nav className="px-2 py-3">
        <Link href="/" className="h-10 px-3 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2">
          <Home size={16} /> Feed
        </Link>
        <Link href="/ai-chat" className="h-10 px-3 rounded-md text-[var(--accent-blue)] border-l-[3px] border-[var(--accent-blue)] bg-[var(--bg-tertiary)] flex items-center gap-2">
          <MessageCircle size={16} /> Chat
        </Link>
        <Link href="/settings" className="h-10 px-3 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2">
          <UserIcon size={16} /> Profile
        </Link>
      </nav>

      <div className="px-3 pb-2">
        <button
          onClick={onCreate}
          className="w-full h-10 rounded-full bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-[var(--accent-blue-hover)] flex items-center justify-center gap-2"
        >
          <Plus size={16} /> New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left rounded-md px-3 py-2 mb-1 border ${
              activeConversationId === c.id
                ? 'border-[var(--border-focus)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <div className="truncate text-sm">{c.title || 'New conversation'}</div>
          </button>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
        {userName || 'User'}
      </div>
    </aside>
  )
}
