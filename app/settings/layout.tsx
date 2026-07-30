import type { Metadata } from 'next'
import SettingsShell from '@/components/SettingsShell'
import { requireAuthenticatedUser } from '@/lib/server/access'

export const metadata: Metadata = {
  title: 'Nustatymai',
  description: 'Tvarkykite savo profilį ir paskyros nuostatas.',
}

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser('/settings')
  return <SettingsShell>{children}</SettingsShell>
}
