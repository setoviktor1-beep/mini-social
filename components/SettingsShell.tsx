'use client'

import { Shield, User } from 'lucide-react'

const tabs = [
  { id: 'profile', label: 'Profilis', icon: User, hash: '' },
  { id: 'account', label: 'Paskyra', icon: Shield, hash: '#account' },
  { id: 'blocked', label: 'Užblokuoti', icon: Shield, hash: '#blocked' },
]

export default function SettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100">Nustatymai</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Tvarkykite savo profilio ir paskyros nustatymus</p>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <nav className="md:w-56 shrink-0">
          <div className="flex md:hidden gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={`/settings${tab.hash}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-700 transition-all min-h-[44px]"
              >
                <tab.icon size={16} />
                {tab.label}
              </a>
            ))}
          </div>
          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={`/settings${tab.hash}`}
                className="flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-all border-b border-gray-50 dark:border-gray-800 last:border-b-0 min-h-[44px]"
              >
                <tab.icon size={18} />
                {tab.label}
              </a>
            ))}
          </div>
        </nav>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
