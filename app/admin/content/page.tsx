'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
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
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">Content Management</h1>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder={tab === 'discussions' ? 'Search titles...' : 'Search content...'}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
          <option value="deleted">Deleted</option>
        </select>
        {tab === 'discussions' && (
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="all">All Categories</option>
            <option value="general">General</option>
            <option value="help">Help</option>
            <option value="offtopic">Off-topic</option>
            <option value="feedback">Feedback</option>
            <option value="news">News</option>
          </select>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
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
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No items found.</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                {tab === 'posts' && (
                  <>
                    <td className="px-6 py-3 text-gray-700 font-medium">@{item.author?.username}</td>
                    <td className="px-6 py-3 text-gray-600 max-w-xs truncate">{item.content?.slice(0, 80) || '(no text)'}{item.content?.length > 80 ? '...' : ''}</td>
                    <td className="px-6 py-3 text-gray-500 text-xs">{item.media?.length || 0}</td>
                    <td className="px-6 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-6 py-3 text-gray-500 text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                  </>
                )}
                {tab === 'discussions' && (
                  <>
                    <td className="px-6 py-3 text-gray-700 font-medium">@{item.author?.username}</td>
                    <td className="px-6 py-3 text-gray-600 max-w-xs truncate">{item.title}</td>
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
                    <td className="px-6 py-3 text-gray-700 font-medium">@{item.author?.username}</td>
                    <td className="px-6 py-3 text-gray-600 max-w-xs truncate">{item.content?.slice(0, 80)}{item.content?.length > 80 ? '...' : ''}</td>
                    <td className="px-6 py-3 text-xs text-blue-600">{item.post_id?.slice(0, 8)}</td>
                    <td className="px-6 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-6 py-3 text-gray-500 text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                  </>
                )}
                <td className="px-6 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {item.status !== 'active' && (
                      <button onClick={() => handleStatusChange(item.id, 'active', item.status)} className="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
                        Restore
                      </button>
                    )}
                    {item.status !== 'hidden' && (
                      <button onClick={() => handleStatusChange(item.id, 'hidden', item.status)} className="px-2 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100">
                        Hide
                      </button>
                    )}
                    {item.status !== 'deleted' && (
                      <button onClick={() => handleStatusChange(item.id, 'deleted', item.status)} className="px-2 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100">
                        Delete
                      </button>
                    )}
                    {tab === 'discussions' && (
                      <>
                        <button onClick={() => handleTogglePin(item.id, item.is_pinned)} className="px-2 py-1 text-xs font-medium bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100">
                          {item.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button onClick={() => handleToggleLock(item.id, item.is_locked)} className="px-2 py-1 text-xs font-medium bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100">
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
