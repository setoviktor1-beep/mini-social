import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search users and posts on Mini Social.',
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}

