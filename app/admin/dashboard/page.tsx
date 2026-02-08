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
    { label: 'Total Users', value: usersRes.count || 0, icon: Users, color: 'bg-blue-50 text-blue-600', href: '/admin/users' },
    { label: 'Active Posts', value: postsRes.count || 0, icon: FileText, color: 'bg-green-50 text-green-600', href: '/admin/content' },
    { label: 'Open Reports', value: reportsRes.count || 0, icon: Flag, color: 'bg-red-50 text-red-600', href: '/admin/reports' },
    { label: 'Discussions', value: discussionsRes.count || 0, icon: MessageSquare, color: 'bg-purple-50 text-purple-600', href: '/admin/content' },
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
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Recent Activity</h2>
          <Link href="/admin/audit-log" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all</Link>
        </div>
        {recentActions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">No moderation activity yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentActions.map((action: any) => (
              <div key={action.id} className="px-6 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-900">@{action.actor?.username || 'unknown'}</span>
                  <span className="text-gray-500 ml-2">{actionLabels[action.action] || action.action}</span>
                  <span className="text-gray-400 ml-2 text-xs">({action.target_type})</span>
                </div>
                <span className="text-gray-400 text-xs whitespace-nowrap">
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
