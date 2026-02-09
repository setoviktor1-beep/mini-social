'use client'
import { User, Shield, Palette } from 'lucide-react'

const tabs = [
  { id: 'profile', label: 'Profile', icon: User, hash: '' },
  { id: 'account', label: 'Account', icon: Shield, hash: '#account' },
  { id: 'appearance', label: 'Appearance', icon: Palette, hash: '#appearance' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your profile and account preferences</p>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar / Tabs */}
        <nav className="md:w-56 shrink-0">
          {/* Mobile: horizontal pills */}
          <div className="flex md:hidden gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={`/settings${tab.hash}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
              >
                <tab.icon size={16} />
                {tab.label}
              </a>
            ))}
          </div>
          {/* Desktop: vertical sidebar */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={`/settings${tab.hash}`}
                className="flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-all border-b border-gray-50 last:border-b-0"
              >
                <tab.icon size={18} />
                {tab.label}
              </a>
            ))}
          </div>
        </nav>
        {/* Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
