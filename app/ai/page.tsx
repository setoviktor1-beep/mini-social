import AIChatClient from '@/components/ai/AIChatClient'

export const dynamic = 'force-dynamic'

export default function AiPage() {
  return (
    <div className="py-4 px-2 sm:px-4">
      <AIChatClient />
    </div>
  )
}
