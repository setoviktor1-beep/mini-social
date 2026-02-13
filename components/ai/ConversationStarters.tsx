'use client'

const starters = [
  'Improve my post',
  'Generate a reply',
  'Check toxicity',
  'Ask AI anything',
]

type ConversationStartersProps = {
  onPick: (value: string) => void
}

export default function ConversationStarters({ onPick }: ConversationStartersProps) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center px-2">
      <h2 className="mb-6 text-2xl font-semibold text-[var(--text-primary)]">How can I help you?</h2>
      <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        {starters.map((item) => (
          <button
            key={item}
            onClick={() => onPick(item)}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-5 text-left text-sm text-[var(--text-primary)] hover:border-[var(--border-focus)] hover:-translate-y-0.5"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}
