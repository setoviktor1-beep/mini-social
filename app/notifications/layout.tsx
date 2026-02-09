import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Your latest likes, comments, follows and post updates.',
}

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children
}

