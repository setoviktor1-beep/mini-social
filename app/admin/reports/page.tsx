'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/backend-client'
import StatusBadge from '@/components/admin/StatusBadge'
import Pagination from '@/components/admin/Pagination'
import ConfirmDialog from '@/components/admin/ConfirmDialog'

const PER_PAGE = 20

export default function AdminReportsPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [mods, setMods] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [targetContent, setTargetContent] = useState<any>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => void; variant?: 'danger' | 'warning' } | null>(null)

  useEffect(() => {
    supabase.from('profiles').select('id, username').in('role', ['admin', 'moderator']).then(({ data }) => {
      setMods(data || [])
    })
  }, [])

  const logAction = async (action: string, targetType: string, targetId: string, details?: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('moderation_actions').insert({
      actor_id: user.id, action, target_type: targetType, target_id: targetId, details: details || {},
    })
  }

  const fetchReports = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('reports').select('*, reporter:reporter_id(username), assignee:assigned_to(username)', { count: 'exact' })

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (typeFilter !== 'all') query = query.eq('target_type', typeFilter)

    query = query.order('created_at', { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
    const { data, count } = await query
    setReports(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, statusFilter, typeFilter])

  useEffect(() => { fetchReports() }, [fetchReports])

  const loadTargetContent = async (report: any) => {
    if (expanded === report.id) {
      setExpanded(null)
      setTargetContent(null)
      return
    }
    setExpanded(report.id)
    let content: any = null
    if (report.target_type === 'post') {
      const { data } = await supabase.from('posts').select('*, author:user_id(username)').eq('id', report.target_id).single()
      content = data
    } else if (report.target_type === 'comment') {
      const { data } = await supabase.from('comments').select('*, author:user_id(username)').eq('id', report.target_id).single()
      content = data
    } else if (report.target_type === 'user') {
      const { data } = await supabase.from('profiles').select('*').eq('id', report.target_id).single()
      content = data
    }
    setTargetContent(content)
  }

  const handleAssign = async (reportId: string, modId: string) => {
    await supabase.from('reports').update({ assigned_to: modId || null }).eq('id', reportId)
    if (modId) await logAction('assign_report', 'report', reportId, { assigned_to: modId })
    fetchReports()
  }

  const handleResolve = (reportId: string) => {
    setConfirm({
      title: 'Resolve Report',
      message: 'Mark this report as reviewed?',
      variant: 'warning',
      action: async () => {
        await supabase.from('reports').update({ status: 'reviewed' }).eq('id', reportId)
        await logAction('resolve_report', 'report', reportId, {})
        setConfirm(null)
        fetchReports()
      },
    })
  }

  const handleClose = (reportId: string) => {
    setConfirm({
      title: 'Close Report',
      message: 'Close this report? This means no action was needed.',
      variant: 'warning',
      action: async () => {
        await supabase.from('reports').update({ status: 'closed' }).eq('id', reportId)
        await logAction('close_report', 'report', reportId, {})
        setConfirm(null)
        fetchReports()
      },
    })
  }

  const handleHideTarget = (report: any) => {
    const table = report.target_type === 'post' ? 'posts' : 'comments'
    const actionName = report.target_type === 'post' ? 'hide_post' : 'hide_comment'
    setConfirm({
      title: 'Hide Content',
      message: `Hide the reported ${report.target_type}?`,
      variant: 'warning',
      action: async () => {
        await supabase.from(table).update({ status: 'hidden' }).eq('id', report.target_id)
        await logAction(actionName, report.target_type, report.target_id, { reason: report.reason })
        await supabase.from('reports').update({ status: 'reviewed' }).eq('id', report.id)
        await logAction('resolve_report', 'report', report.id, {})
        setConfirm(null)
        fetchReports()
      },
    })
  }

  const handleDeleteTarget = (report: any) => {
    const table = report.target_type === 'post' ? 'posts' : 'comments'
    const actionName = report.target_type === 'post' ? 'delete_post' : 'delete_comment'
    setConfirm({
      title: 'Delete Content',
      message: `Delete the reported ${report.target_type}? This cannot be easily undone.`,
      variant: 'danger',
      action: async () => {
        await supabase.from(table).update({ status: 'deleted' }).eq('id', report.target_id)
        await logAction(actionName, report.target_type, report.target_id, { reason: report.reason })
        await supabase.from('reports').update({ status: 'reviewed' }).eq('id', report.id)
        await logAction('resolve_report', 'report', report.id, {})
        setConfirm(null)
        fetchReports()
      },
    })
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="mt-12 lg:mt-0">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">Reports</h1>

      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-200 flex-1 sm:flex-none min-h-[44px]">
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="closed">Closed</option>
        </select>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-200 flex-1 sm:flex-none min-h-[44px]">
          <option value="all">All Types</option>
          <option value="post">Post</option>
          <option value="comment">Comment</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Reporter</th>
                <th className="px-6 py-3">Assigned</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">No reports found.</td></tr>
              ) : reports.map(report => (
                <>
                  <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-3">
                      <button onClick={() => loadTargetContent(report)} className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase hover:underline min-h-[36px]">
                        {report.target_type}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{report.reason}</td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">@{report.reporter?.username}</td>
                    <td className="px-6 py-3">
                      <select
                        value={report.assigned_to || ''}
                        onChange={e => handleAssign(report.id, e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-200"
                      >
                        <option value="">Unassigned</option>
                        {mods.map(m => (
                          <option key={m.id} value={m.id}>@{m.username}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3"><StatusBadge status={report.status} /></td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(report.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {report.status === 'open' && (
                          <>
                            {report.target_type !== 'user' && (
                              <>
                                <button onClick={() => handleHideTarget(report)} className="px-2 py-1 text-xs font-medium bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50">
                                  Hide
                                </button>
                                <button onClick={() => handleDeleteTarget(report)} className="px-2 py-1 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50">
                                  Delete
                                </button>
                              </>
                            )}
                            <button onClick={() => handleResolve(report.id)} className="px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50">
                              Resolve
                            </button>
                            <button onClick={() => handleClose(report.id)} className="px-2 py-1 text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                              Close
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === report.id && targetContent && (
                    <tr key={`${report.id}-content`}>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-l-4 border-blue-400">
                        <div className="text-sm">
                          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {report.target_type === 'user' ? `@${targetContent.username}` : `By @${targetContent.author?.username}`}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400">
                            {report.target_type === 'user'
                              ? `Role: ${targetContent.role} | Suspended: ${targetContent.is_suspended ? 'Yes' : 'No'}`
                              : targetContent.content || targetContent.title || '(no content)'}
                          </p>
                          {targetContent.status && (
                            <p className="mt-1"><StatusBadge status={targetContent.status} /></p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center text-gray-400 dark:text-gray-500">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center text-gray-400 dark:text-gray-500">No reports found.</div>
        ) : reports.map(report => (
          <div key={report.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => loadTargetContent(report)} className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase hover:underline min-h-[36px]">
                {report.target_type}
              </button>
              <StatusBadge status={report.status} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{report.reason}</p>
            <div className="flex items-center gap-2 mb-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
              <span>Reporter: @{report.reporter?.username}</span>
              <span className="text-gray-300 dark:text-gray-600">&middot;</span>
              <span>{new Date(report.created_at).toLocaleDateString()}</span>
            </div>
            <div className="mb-3">
              <select
                value={report.assigned_to || ''}
                onChange={e => handleAssign(report.id, e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-200 w-full min-h-[36px]"
              >
                <option value="">Unassigned</option>
                {mods.map(m => (
                  <option key={m.id} value={m.id}>@{m.username}</option>
                ))}
              </select>
            </div>

            {expanded === report.id && targetContent && (
              <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-4 border-blue-400">
                <p className="font-medium text-gray-700 dark:text-gray-300 text-sm mb-1">
                  {report.target_type === 'user' ? `@${targetContent.username}` : `By @${targetContent.author?.username}`}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {report.target_type === 'user'
                    ? `Role: ${targetContent.role} | Suspended: ${targetContent.is_suspended ? 'Yes' : 'No'}`
                    : targetContent.content || targetContent.title || '(no content)'}
                </p>
                {targetContent.status && (
                  <p className="mt-1"><StatusBadge status={targetContent.status} /></p>
                )}
              </div>
            )}

            {report.status === 'open' && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex-wrap">
                {report.target_type !== 'user' && (
                  <>
                    <button onClick={() => handleHideTarget(report)} className="px-3 py-1.5 text-xs font-medium bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50 min-h-[36px]">
                      Hide
                    </button>
                    <button onClick={() => handleDeleteTarget(report)} className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 min-h-[36px]">
                      Delete
                    </button>
                  </>
                )}
                <button onClick={() => handleResolve(report.id)} className="px-3 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 min-h-[36px]">
                  Resolve
                </button>
                <button onClick={() => handleClose(report.id)} className="px-3 py-1.5 text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-h-[36px]">
                  Close
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} perPage={PER_PAGE} />

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          variant={confirm.variant}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
