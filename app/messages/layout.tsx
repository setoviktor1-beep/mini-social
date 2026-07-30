import type { Metadata } from 'next'
import { requireAuthenticatedUser } from '@/lib/server/access'

export const metadata: Metadata = {
  title: 'Žinutės',
  description: 'Chat with friends in real-time.',
}

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser('/messages')
  return children
}
