'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/backend-client'
import { useRouter } from 'next/navigation'
import { UserPlus, UserCheck, UserX, Clock } from 'lucide-react'

interface FriendButtonProps {
  profileId: string
  currentUserId?: string
}

type FriendStatus = 'none' | 'sent' | 'received' | 'friends'

export default function FriendButton({ profileId, currentUserId }: FriendButtonProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [status, setStatus] = useState<FriendStatus>('none')
  const [loading, setLoading] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const checkStatus = useCallback(async () => {
    if (!currentUserId) return

    const { data: sent } = await supabase
      .from('friend_requests')
      .select('id, status')
      .eq('sender_id', currentUserId)
      .eq('receiver_id', profileId)
      .maybeSingle()

    if (sent) {
      setRequestId(sent.id)
      setStatus(sent.status === 'accepted' ? 'friends' : sent.status === 'pending' ? 'sent' : 'none')
      return
    }

    const { data: received } = await supabase
      .from('friend_requests')
      .select('id, status')
      .eq('sender_id', profileId)
      .eq('receiver_id', currentUserId)
      .maybeSingle()

    if (received) {
      setRequestId(received.id)
      setStatus(received.status === 'accepted' ? 'friends' : received.status === 'pending' ? 'received' : 'none')
      return
    }

    setStatus('none')
  }, [currentUserId, profileId, supabase])

  useEffect(() => {
    if (!currentUserId || currentUserId === profileId) return
    const init = async () => {
      const [{ data: blocksByMe }, { data: blocksMe }] = await Promise.all([
        supabase.from('blocks').select('id').eq('blocker_id', currentUserId).eq('blocked_id', profileId),
        supabase.from('blocks').select('id').eq('blocker_id', profileId).eq('blocked_id', currentUserId),
      ])
      const isBlocked = !!(blocksByMe && blocksByMe.length) || !!(blocksMe && blocksMe.length)
      setBlocked(isBlocked)
      if (!isBlocked) checkStatus()
    }
    init()
  }, [currentUserId, profileId, supabase, checkStatus])

  const sendRequest = async () => {
    if (!currentUserId || blocked) return
    setLoading(true)
    const { data } = await supabase
      .from('friend_requests')
      .insert({ sender_id: currentUserId, receiver_id: profileId })
      .select()
      .single()
    if (data) {
      setRequestId(data.id)
      setStatus('sent')
      showToast('Draugystės užklausa išsiųsta!')
    }
    setLoading(false)
  }

  const acceptRequest = async () => {
    if (!requestId || blocked) return
    setLoading(true)
    await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
    setStatus('friends')
    setLoading(false)
    showToast('Draugystė patvirtinta!')
    router.refresh()
  }

  const declineOrCancel = async () => {
    if (!requestId) return
    setLoading(true)
    await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId)
    setStatus('none')
    setRequestId(null)
    setLoading(false)
    router.refresh()
  }

  if (!currentUserId || currentUserId === profileId || blocked) return null

  const ToastEl = toast ? (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg border border-gray-700 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {toast}
    </div>
  ) : null

  if (status === 'friends') {
    return (
      <>
        {ToastEl}
        <div className="flex gap-2">
          <span className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-green-600 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-sm">
            <UserCheck size={16} />
            Draugai
          </span>
          <button
            onClick={declineOrCancel}
            disabled={loading}
            className="p-2.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Pašalinti iš draugų"
          >
            <UserX size={16} />
          </button>
        </div>
      </>
    )
  }

  if (status === 'sent') {
    return (
      <>
        {ToastEl}
        <button
          onClick={declineOrCancel}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 hover:border-red-200 dark:hover:border-red-700 transition-colors text-sm"
        >
          <Clock size={16} />
          {loading ? '...' : 'Užklausa išsiųsta'}
        </button>
      </>
    )
  }

  if (status === 'received') {
    return (
      <>
        {ToastEl}
        <div className="flex gap-2">
          <button
            onClick={acceptRequest}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm shadow-sm"
          >
            <UserCheck size={16} />
            {loading ? '...' : 'Priimti'}
          </button>
          <button
            onClick={declineOrCancel}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors text-sm"
          >
            <UserX size={16} />
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {ToastEl}
      <button
        onClick={sendRequest}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold bg-green-600 text-white hover:bg-green-700 transition-colors text-sm shadow-sm"
      >
        <UserPlus size={16} />
        {loading ? '...' : 'Pridėti draugą'}
      </button>
    </>
  )
}
