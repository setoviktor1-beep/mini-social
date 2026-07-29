'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/backend-client'
import StatusBadge from '@/components/admin/StatusBadge'
import Pagination from '@/components/admin/Pagination'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { Pin, Lock, Unlock } from 'lucide-react'

const PER_PAGE = 20

type Tab = 'posts' | 'discussions' | 'comments'

export default function AdminContentPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('posts')
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => void; variant?: 'danger' | 'warning' } | null>(null)

  const logAction = async (action: string, targetType: string, targetId: string, details?: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('moderation_actions').insert({
      actor_id: user.id, action, target_type: targetType, target_id: targetId, details: details || {},
    })
  }

  const fetchItems = useCallback(async () => {
    setLoading(true)
    let query: any

    if (tab === 'posts') {
      query = supabase.from('posts').select('*, author:user_id(username), media:post_media(id)', { count: 'exact' })
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search) query = query.ilike('content', `%${search}%`)
    } else if (tab === 'discussions') {
      query = supabase.from('discussions').select('*, author:user_id(username)', { count: 'exact' })
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
      if (search) query = query.ilike('title', `%${search}%`)
    } else {
      query = supabase.from('comments').select('*, author:user_id(username)', { count: 'exact' })
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search) query = query.ilike('content', `%${search}%`)
    }

    query = query.order('created_at', { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
    const { data, count } = await query
    setItems(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [tab, page, statusFilter, search, categoryFilter])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { setPage(1); setStatusFilter('all'); setSearch(''); setCategoryFilter('all') }, [tab])

  const handleStatusChange = (id: string, newStatus: string, currentStatus: string) => {
    const table = tab
    const targetType = tab === 'posts' ? 'post' : tab === 'discussions' ? 'discussion' : 'comment'
    const actionMap: Record<string, string> = {
      hidden: `hide_${targetType}`,
      deleted: `delete_${targetType}`,
      active: `restore_${targetType}`,
    }

    setConfirm({
      title: `${newStatus === 'active' ? 'Restore' : newStatus === 'hidden' ? 'Hide' : 'Delete'} ${targetType}`,
      message: `Are you sure you want to ${newStatus === 'active' ? 'restore' : newStatus} this ${targetType}?`,
      variant: newStatus === 'deleted' ? 'danger' : 'warning',
      action: async () => {
        await supabase.from(table).update({ status: newStatus }).eq('id', id)
        await logAction(actionMap[newStatus], targetType, id, { old_status: currentStatus, new_status: newStatus })
        setConfirm(null)
        fetchItems()
      },
    })
  }

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    await supabase.from('discussions').update({ is_pinned: !isPinned }).eq('id', id)
    fetchItems()
  }

  const handleToggleLock = async (id: string, isLocked: boolean) => {
    await supabase.from('discussions').update({ is_locked: !isLocked }).eq('id', id)
    fetchItems()
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'discussions', label: 'Discussions' },
    { key: 'comments', label: 'Comments' },
  ]

  return (
    <div className="mt-12 lg:mt-0">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">Content Management</h1>

      <div className="flex gap-1 mb-4 sm:mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors min-h-[40px] flex-1 sm:flex-none ${tab === t.key ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
        <input
          type="text"
          placeholder={tab === 'discussions' ? 'Search titles...' : 'Search content...'}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 min-h-[44px] bg-white dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
        />
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-200 flex-1 sm:flex-none min-h-[44px]">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="deleted">Deleted</option>
          </select>
          {tab === 'discussions' && (
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-200 flex-1 sm:flex-none min-h-[44px]">
              <option value="all">All Categories</option>
              <option value="general">General</option>
              <option value="help">Help</option>
              <option value="offtopic">Off-topic</option>
              <option value="feedback">Feedback</option>
              <option value="news">News</option>
            </select>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {tab === 'posts' && (
                <tr>
                  <th className="px-6 py-3">Author</th>
                  <th className="px-6 py-3">Content</th>
                  <th className="px-6 py-3">Media</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              )}
              {tab === 'discussions' && (
                <tr>
                  <th className="px-6 py-3">Author</th>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Flags</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              )}
              {tab === 'comments' && (
                <tr>
                  <th className="px-6 py-3">Author</th>
                  <th className="px-6 py-3">Content</th>
                  <th className="px-6 py-3">Post</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">No items found.</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  {tab === 'posts' && (
                    <>
                      <td className="px-6 py-3 text-gray-700 dark:text-gray-300 font-medium">@{item.author?.username}</td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{item.content?.slice(0, 80) || '(no text)'}{item.content?.length > 80 ? '...' : ''}</td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{item.media?.length || 0}</td>
                      <td className="px-6 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                    </>
                  )}
                  {tab === 'discussions' && (
                    <>
                      <td className="px-6 py-3 text-gray-700 dark:text-gray-300 font-medium">@{item.author?.username}</td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{item.title}</td>
                      <td className="px-6 py-3"><StatusBadge status={item.category} /></td>
                      <td className="px-6 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1">
                          {item.is_pinned && <span className="text-yellow-600" title="Pinned"><Pin size={14} /></span>}
                          {item.is_locked && <span className="text-gray-500" title="Locked"><Lock size={14} /></span>}
                        </div>
                      </td>
                    </>
                  )}
                  {tab === 'comments' && (
                    <>
                      <td className="px-6 py-3 text-gray-700 dark:text-gray-300 font-medium">@{item.author?.username}</td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{item.content?.slice(0, 80)}{item.content?.length > 80 ? '...' : ''}</td>
                      <td className="px-6 py-3 text-xs text-blue-600 dark:text-blue-400">{item.post_id?.slice(0, 8)}</td>
                      <td className="px-6 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                    </>
                  )}
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {item.status !== 'active' && (
                        <button onClick={() => handleStatusChange(item.id, 'active', item.status)} className="px-2 py-1 text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50">
                          Restore
                        </button>
                      )}
                      {item.status !== 'hidden' && (
                        <button onClick={() => handleStatusChange(item.id, 'hidden', item.status)} className="px-2 py-1 text-xs font-medium bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50">
                          Hide
                        </button>
                      )}
                      {item.status !== 'deleted' && (
                        <button onClick={() => handleStatusChange(item.id, 'deleted', item.status)} className="px-2 py-1 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50">
                          Delete
                        </button>
                      )}
                      {tab === 'discussions' && (
                        <>
                          <button onClick={() => handleTogglePin(item.id, item.is_pinned)} className="px-2 py-1 text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            {item.is_pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button onClick={() => handleToggleLock(item.id, item.is_locked)} className="px-2 py-1 text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            {item.is_locked ? 'Unlock' : 'Lock'}
                          </button>
                        </>
                      )}
                    </div>
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
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center text-gray-400 dark:text-gray-500">No items found.</div>
        ) : items.map(item => (
          <div key={item.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">@{item.author?.username}</span>
              <StatusBadge status={item.status} />
            </div>

            {tab === 'posts' && (
              <>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.content || '(no text)'}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span>Media: {item.media?.length || 0}</span>
                  <span className="text-gray-300">&middot;</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </>
            )}

            {tab === 'discussions' && (
              <>
                <p className="text-sm text-gray-600 font-medium mb-2 line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <StatusBadge status={item.category} />
                  {item.is_pinned && <span className="text-yellow-600" title="Pinned"><Pin size={14} /></span>}
                  {item.is_locked && <span className="text-gray-500" title="Locked"><Lock size={14} /></span>}
                </div>
              </>
            )}

            {tab === 'comments' && (
              <>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.content}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span className="text-blue-600">Post: {item.post_id?.slice(0, 8)}</span>
                  <span className="text-gray-300">&middot;</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex-wrap">
              {item.status !== 'active' && (
                <button onClick={() => handleStatusChange(item.id, 'active', item.status)} className="px-3 py-1.5 text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 min-h-[36px]">
                  Restore
                </button>
              )}
              {item.status !== 'hidden' && (
                <button onClick={() => handleStatusChange(item.id, 'hidden', item.status)} className="px-3 py-1.5 text-xs font-medium bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50 min-h-[36px]">
                  Hide
                </button>
              )}
              {item.status !== 'deleted' && (
                <button onClick={() => handleStatusChange(item.id, 'deleted', item.status)} className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 min-h-[36px]">
                  Delete
                </button>
              )}
              {tab === 'discussions' && (
                <>
                  <button onClick={() => handleTogglePin(item.id, item.is_pinned)} className="px-3 py-1.5 text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-h-[36px]">
                    {item.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button onClick={() => handleToggleLock(item.id, item.is_locked)} className="px-3 py-1.5 text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-h-[36px]">
                    {item.is_locked ? 'Unlock' : 'Lock'}
                  </button>
                </>
              )}
            </div>
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
