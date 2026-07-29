import { createClient } from '@/lib/backend-server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import AdminSidebar from '@/components/admin/AdminSidebar'

export const metadata = { title: 'Admin — MiniSocial' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  // Login page gets a clean layout without sidebar/auth check
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, username')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'moderator')) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminSidebar username={profile.username} role={profile.role} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
