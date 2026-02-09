import { createClient } from '@/lib/server-supabase'
import { Users, FileText, Flag, MessageSquare } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const supabase = createClient()

  const [usersRes, postsRes, reportsRes, discussionsRes, actionsRes] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('discussions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('moderation_actions').select('*, actor:actor_id(username)').order('created_at', { ascending: false }).limit(10),
  ])

  const stats = [
    { label: 'Total Users', value: usersRes.count || 0, icon: Users, color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', href: '/admin/users' },
    { label: 'Active Posts', value: postsRes.count || 0, icon: FileText, color: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400', href: '/admin/content' },
    { label: 'Open Reports', value: reportsRes.count || 0, icon: Flag, color: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400', href: '/admin/reports' },
    { label: 'Discussions', value: discussionsRes.count || 0, icon: MessageSquare, color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400', href: '/admin/content' },
  ]

  const actionLabels: Record<string, string> = {
    suspend_user: 'Suspended user',
    unsuspend_user: 'Unsuspended user',
    change_role: 'Changed role',
    hide_post: 'Hid post',
    delete_post: 'Deleted post',
    restore_post: 'Restored post',
    hide_comment: 'Hid comment',
    delete_comment: 'Deleted comment',
    restore_comment: 'Restored comment',
    hide_discussion: 'Hid discussion',
    delete_discussion: 'Deleted discussion',
    restore_discussion: 'Restored discussion',
    resolve_report: 'Resolved report',
    close_report: 'Closed report',
    assign_report: 'Assigned report',
  }

  const recentActions = actionsRes.data || []

  return (
    <div className="pl-0 lg:pl-0">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 mb-4 sm:mb-6 mt-12 lg:mt-0">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href} className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-100 dark:border-gray-800 hover:shadow-md dark:hover:shadow-gray-900/40 transition-shadow">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-3 ${stat.color}`}>
              <stat.icon size={18} />
            </div>
            <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">{stat.value}</p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Recent Activity</h2>
          <Link href="/admin/audit-log" className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">View all</Link>
        </div>
        {recentActions.length === 0 ? (
          <div className="px-4 sm:px-6 py-12 text-center text-gray-400 dark:text-gray-500">No moderation activity yet.</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {recentActions.map((action: any) => (
              <div key={action.id} className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900 dark:text-gray-100">@{action.actor?.username || 'unknown'}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">{actionLabels[action.action] || action.action}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1 sm:ml-2 text-xs">({action.target_type})</span>
                </div>
                <span className="text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap flex-shrink-0">
                  {new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
