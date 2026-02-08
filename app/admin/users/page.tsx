'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import StatusBadge from '@/components/admin/StatusBadge'
import Pagination from '@/components/admin/Pagination'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { ExternalLink } from 'lucide-react'

const PER_PAGE = 20

export default function AdminUsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => void; variant?: 'danger' | 'warning' } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
        setCurrentUserRole(profile?.role || '')
      }
    })
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('profiles').select('*', { count: 'exact' })

    if (search) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
    }
    if (roleFilter !== 'all') query = query.eq('role', roleFilter)
    if (statusFilter === 'active') query = query.eq('is_suspended', false)
    if (statusFilter === 'suspended') query = query.eq('is_suspended', true)

    query = query.order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

    const { data, count } = await query
    setUsers(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const logAction = async (action: string, targetType: string, targetId: string, details: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('moderation_actions').insert({
      actor_id: user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    })
  }

  const handleSuspend = (userId: string, username: string, currentlySuspended: boolean) => {
    const action = currentlySuspended ? 'unsuspend_user' : 'suspend_user'
    setConfirm({
      title: currentlySuspended ? 'Unsuspend User' : 'Suspend User',
      message: currentlySuspended
        ? `Are you sure you want to unsuspend @${username}?`
        : `Are you sure you want to suspend @${username}? They will be unable to post.`,
      variant: currentlySuspended ? 'warning' : 'danger',
      action: async () => {
        await supabase.from('profiles').update({ is_suspended: !currentlySuspended }).eq('id', userId)
        await logAction(action, 'user', userId, { username })
        setConfirm(null)
        fetchUsers()
      },
    })
  }

  const handleRoleChange = (userId: string, username: string, currentRole: string, newRole: string) => {
    if (newRole === currentRole) return
    setConfirm({
      title: 'Change Role',
      message: `Change @${username}'s role from ${currentRole} to ${newRole}?`,
      variant: 'warning',
      action: async () => {
        await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
        await logAction('change_role', 'user', userId, { username, old_value: currentRole, new_value: newRole })
        setConfirm(null)
        fetchUsers()
      },
    })
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">User Management</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Joined</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No users found.</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                      {user.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">@{user.username}</p>
                      <p className="text-xs text-gray-500">{user.display_name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3"><StatusBadge status={user.role} /></td>
                <td className="px-6 py-3"><StatusBadge status={user.is_suspended ? 'suspended' : 'active'} /></td>
                <td className="px-6 py-3 text-gray-500 text-xs">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <a href={`/u/${user.username}`} target="_blank" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600" title="View profile">
                      <ExternalLink size={16} />
                    </a>
                    {user.id !== currentUserId && (
                      <>
                        <button
                          onClick={() => handleSuspend(user.id, user.username, user.is_suspended)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg ${user.is_suspended ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                        >
                          {user.is_suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                        {currentUserRole === 'admin' && (
                          <select
                            value={user.role}
                            onChange={e => handleRoleChange(user.id, user.username, user.role, e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                          >
                            <option value="user">user</option>
                            <option value="moderator">moderator</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
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
