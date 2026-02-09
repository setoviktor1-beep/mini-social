import type { Metadata } from 'next'
import SettingsShell from '@/components/SettingsShell'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your profile and account preferences.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>
}

