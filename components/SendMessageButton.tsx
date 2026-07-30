'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/backend-client'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'

interface SendMessageButtonProps {
  otherUserId: string
}

export default function SendMessageButton({ otherUserId }: SendMessageButtonProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        setLoading(false)
        return
      }

      const [{ data: blocksByMe }, { data: blocksMe }] = await Promise.all([
        supabase.from('blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', otherUserId),
        supabase.from('blocks').select('id').eq('blocker_id', otherUserId).eq('blocked_id', user.id),
      ])
      const isBlocked = !!(blocksByMe && blocksByMe.length) || !!(blocksMe && blocksMe.length)
      if (isBlocked) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        other_user_id: otherUserId
      })

      if (error) {
        console.error('Error creating conversation:', error)
        setLoading(false)
        return
      }

      router.push(`/messages/${data}`)
    } catch (err) {
      console.error('Error:', err)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2.5 rounded-full font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700 hover:text-blue-600 transition-all disabled:opacity-50"
    >
      <MessageCircle size={18} />
      {loading ? 'Atidaroma...' : 'Rašyti žinutę'}
    </button>
  )
}
