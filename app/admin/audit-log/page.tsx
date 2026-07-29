'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/backend-client'
import Pagination from '@/components/admin/Pagination'

const PER_PAGE = 30

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

const actionColors: Record<string, string> = {
  suspend_user: 'text-red-600 bg-red-50',
  unsuspend_user: 'text-green-600 bg-green-50',
  change_role: 'text-purple-600 bg-purple-50',
  hide_post: 'text-yellow-600 bg-yellow-50',
  hide_comment: 'text-yellow-600 bg-yellow-50',
  hide_discussion: 'text-yellow-600 bg-yellow-50',
  delete_post: 'text-red-600 bg-red-50',
  delete_comment: 'text-red-600 bg-red-50',
  delete_discussion: 'text-red-600 bg-red-50',
  restore_post: 'text-green-600 bg-green-50',
  restore_comment: 'text-green-600 bg-green-50',
  restore_discussion: 'text-green-600 bg-green-50',
  resolve_report: 'text-blue-600 bg-blue-50',
  close_report: 'text-gray-600 bg-gray-100',
  assign_report: 'text-indigo-600 bg-indigo-50',
}

export default function AdminAuditLogPage() {
  const supabase = createClient()
  const [actions, setActions] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [actors, setActors] = useState<any[]>([])

  useEffect(() => {
    supabase.from('profiles').select('id, username').in('role', ['admin', 'moderator']).then(({ data }) => {
      setActors(data || [])
    })
  }, [])

  const fetchActions = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('moderation_actions').select('*, actor:actor_id(username)', { count: 'exact' })

    if (actionFilter !== 'all') query = query.eq('action', actionFilter)
    if (actorFilter !== 'all') query = query.eq('actor_id', actorFilter)

    query = query.order('created_at', { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
    const { data, count } = await query
    setActions(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, actionFilter, actorFilter])

  useEffect(() => { fetchActions() }, [fetchActions])

  const totalPages = Math.ceil(total / PER_PAGE)

  const allActions = Object.keys(actionLabels)

  return (
    <div className="mt-12 lg:mt-0">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">Audit Log</h1>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-200 min-h-[44px] w-full sm:w-auto">
          <option value="all">All Actions</option>
          {allActions.map(a => (
            <option key={a} value={a}>{actionLabels[a]}</option>
          ))}
        </select>
        <select value={actorFilter} onChange={e => { setActorFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-200 min-h-[44px] w-full sm:w-auto">
          <option value="all">All Actors</option>
          {actors.map(a => (
            <option key={a.id} value={a.id}>@{a.username}</option>
          ))}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Target</th>
                <th className="px-6 py-3">Details</th>
                <th className="px-6 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>
              ) : actions.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">No audit log entries.</td></tr>
              ) : actions.map(action => (
                <tr key={action.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">@{action.actor?.username || 'unknown'}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${actionColors[action.action] || 'text-gray-600 bg-gray-100'}`}>
                      {actionLabels[action.action] || action.action}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs text-gray-500 uppercase font-bold">{action.target_type}</span>
                    <span className="text-xs text-gray-400 ml-1">{action.target_id?.slice(0, 8)}</span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {action.details && Object.keys(action.details).length > 0
                      ? Object.entries(action.details).map(([k, v]) => `${k}: ${v}`).join(', ')
                      : '\u2014'}
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
        ) : actions.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center text-gray-400 dark:text-gray-500">No audit log entries.</div>
        ) : actions.map(action => (
          <div key={action.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 text-sm">@{action.actor?.username || 'unknown'}</span>
              <span className="text-xs text-gray-400">
                {new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="mb-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${actionColors[action.action] || 'text-gray-600 bg-gray-100'}`}>
                {actionLabels[action.action] || action.action}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className="uppercase font-bold">{action.target_type}</span>
              <span className="text-gray-400">{action.target_id?.slice(0, 8)}</span>
            </div>
            {action.details && Object.keys(action.details).length > 0 && (
              <p className="text-xs text-gray-500 mt-1 break-words">
                {Object.entries(action.details).map(([k, v]) => `${k}: ${v}`).join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} perPage={PER_PAGE} />
    </div>
  )
}
