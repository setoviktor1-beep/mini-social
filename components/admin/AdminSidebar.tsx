'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, FileText, Flag, ScrollText, ArrowLeft, LogOut, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/content', label: 'Content', icon: FileText },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
]

export default function AdminSidebar({ username, role }: { username: string; role: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const sidebarContent = (
    <>
      <div className="p-4 sm:p-6 border-b border-gray-800">
        <h1 className="text-base sm:text-lg font-black text-white">MiniSocial Admin</h1>
        <p className="text-xs text-gray-500 mt-1 capitalize">{role}</p>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 sm:px-3">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                active ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-2 sm:p-3 border-t border-gray-800 space-y-1">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 hover:text-white transition-colors min-h-[44px]"
        >
          <ArrowLeft size={18} />
          Back to site
        </Link>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs text-gray-500 truncate">@{username}</span>
          <button onClick={handleLogout} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 bg-gray-900 text-white p-2 rounded-lg shadow-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Open admin menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="w-64 bg-gray-900 text-gray-300 flex flex-col h-full"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-gray-900 text-gray-300 flex-col min-h-screen shrink-0">
        {sidebarContent}
      </aside>
    </>
  )
}
