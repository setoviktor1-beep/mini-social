import type { Metadata } from 'next'
import { requireAuthenticatedUser } from '@/lib/server/access'

export const metadata: Metadata = {
  title: 'AI Asistentas | MiniSocial',
  description: 'Privatus AI asistentas socialiniam tinklui ir verslui',
}

export default async function AiLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser('/ai')
  return children
}
