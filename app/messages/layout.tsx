import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Chat with friends in real-time.',
}

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children
}

