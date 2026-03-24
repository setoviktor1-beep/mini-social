import type { Metadata } from 'next'
import SettingsShell from '@/components/SettingsShell'
import { requireAuthenticatedUser } from '@/lib/server/access'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your profile and account preferences.',
}

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser('/settings')
  return <SettingsShell>{children}</SettingsShell>
}
