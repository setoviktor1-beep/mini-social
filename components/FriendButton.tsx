'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { UserPlus, UserCheck, UserX, Clock } from 'lucide-react'

interface FriendButtonProps {
  profileId: string
  currentUserId?: string
}

type FriendStatus = 'none' | 'sent' | 'received' | 'friends'

export default function FriendButton({ profileId, currentUserId }: FriendButtonProps) {
  const supabase = createClient()
  const router = useRouter()
  const [status, setStatus] = useState<FriendStatus>('none')
  const [loading, setLoading] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUserId || currentUserId === profileId) return
    checkStatus()
  }, [currentUserId, profileId])

  const checkStatus = async () => {
    if (!currentUserId) return

    // Check if I sent a request
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

    // Check if they sent me a request
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
  }

  const sendRequest = async () => {
    if (!currentUserId) return
    setLoading(true)
    const { data } = await supabase
      .from('friend_requests')
      .insert({ sender_id: currentUserId, receiver_id: profileId })
      .select()
      .single()
    if (data) {
      setRequestId(data.id)
      setStatus('sent')
    }
    setLoading(false)
  }

  const acceptRequest = async () => {
    if (!requestId) return
    setLoading(true)
    await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
    setStatus('friends')
    setLoading(false)
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

  if (!currentUserId || currentUserId === profileId) return null

  if (status === 'friends') {
    return (
      <div className="flex gap-2">
        <span className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-green-600 bg-green-50 border border-green-200 text-sm">
          <UserCheck size={16} />
          Friends
        </span>
        <button
          onClick={declineOrCancel}
          disabled={loading}
          className="p-2.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Unfriend"
        >
          <UserX size={16} />
        </button>
      </div>
    )
  }

  if (status === 'sent') {
    return (
      <button
        onClick={declineOrCancel}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-gray-500 bg-gray-100 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-sm"
      >
        <Clock size={16} />
        {loading ? '...' : 'Request Sent'}
      </button>
    )
  }

  if (status === 'received') {
    return (
      <div className="flex gap-2">
        <button
          onClick={acceptRequest}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm shadow-sm"
        >
          <UserCheck size={16} />
          {loading ? '...' : 'Accept'}
        </button>
        <button
          onClick={declineOrCancel}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-600 transition-colors text-sm"
        >
          <UserX size={16} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={sendRequest}
      disabled={loading}
      className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold bg-green-600 text-white hover:bg-green-700 transition-colors text-sm shadow-sm"
    >
      <UserPlus size={16} />
      {loading ? '...' : 'Add Friend'}
    </button>
  )
}
