'use client'

type ChatMessageProps = {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export default function ChatMessage({ role, content, createdAt }: ChatMessageProps) {
  const isUser = role === 'user'
  const time = createdAt ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className={`group flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[92%] sm:max-w-[80%] ${isUser ? 'bg-[var(--bg-tertiary)] rounded-2xl px-4 py-3' : 'px-1 py-1'}`}>
        {!isUser && (
          <div className="mb-2 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#0084ff] to-[#00c6ff] text-white text-xs font-semibold flex items-center justify-center">
              ✦
            </div>
            <span className="text-xs text-[var(--text-secondary)]">Meta AI</span>
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm sm:text-[15px] text-[var(--text-primary)]">{content}</p>
        {time && (
          <div className="mt-1 text-[11px] text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100">
            {time}
          </div>
        )}
      </div>
    </div>
  )
}
