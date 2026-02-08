'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, FileText, Flag, ScrollText, ArrowLeft, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col min-h-screen shrink-0">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-lg font-black text-white">MiniSocial Admin</h1>
        <p className="text-xs text-gray-500 mt-1 capitalize">{role}</p>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-800 space-y-1">
        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 hover:text-white transition-colors">
          <ArrowLeft size={18} />
          Back to site
        </Link>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs text-gray-500 truncate">@{username}</span>
          <button onClick={handleLogout} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
