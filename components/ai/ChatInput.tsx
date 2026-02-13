'use client'

import { useRef } from 'react'
import { ArrowUp } from 'lucide-react'

type ChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  loading?: boolean
}

export default function ChatInput({ value, onChange, onSend, loading = false }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const canSend = value.trim().length > 0 && !loading

  return (
    <div className="sticky bottom-0 pt-3 pb-4 bg-gradient-to-t from-[var(--bg-primary)] to-transparent">
      <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 focus-within:border-[var(--accent-blue)] focus-within:shadow-[0_0_0_3px_rgba(0,132,255,0.18)]">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              e.target.style.height = '44px'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSend) onSend()
              }
            }}
            className="w-full resize-none bg-transparent px-2 py-2 text-sm sm:text-[15px] outline-none placeholder:text-[var(--text-tertiary)]"
            placeholder="Ask anything..."
            rows={1}
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          {canSend && (
            <button
              onClick={onSend}
              className="mb-1 h-9 w-9 rounded-full bg-[var(--accent-blue)] text-white flex items-center justify-center hover:bg-[var(--accent-blue-hover)]"
              aria-label="Send"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
