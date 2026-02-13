'use client'

const starters = [
  { key: 'improve_post', label: 'Improve my post' },
  { key: 'generate_reply', label: 'Generate a reply' },
  { key: 'check_toxicity', label: 'Check toxicity' },
  { key: 'ask_anything', label: 'Ask AI anything' },
] as const

type ConversationStartersProps = {
  onPick: (key: string, label: string) => void
}

export default function ConversationStarters({ onPick }: ConversationStartersProps) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center px-2">
      <h2 className="mb-6 text-2xl font-semibold text-[var(--text-primary)]">How can I help you?</h2>
      <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        {starters.map((item) => (
          <button
            key={item.key}
            onClick={() => onPick(item.key, item.label)}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-5 text-left text-sm text-[var(--text-primary)] hover:border-[var(--border-focus)] hover:-translate-y-0.5"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
