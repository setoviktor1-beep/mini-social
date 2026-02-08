'use client'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Shield, MessageSquare, MessagesSquare } from 'lucide-react'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => setRole(profile?.role || 'user'))

        // Check unread messages
        fetchUnread(data.user.id)
      }
    })
  }, [])

  const fetchUnread = async (userId: string) => {
    // Get conversations where user is participant
    const { data: convos } = await supabase
      .from('conversations')
      .select('id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

    if (convos && convos.length > 0) {
      const convoIds = convos.map(c => c.id)
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convoIds)
        .neq('sender_id', userId)
        .eq('is_read', false)

      setUnreadCount(count || 0)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.refresh()
    router.push('/auth/login')
  }

  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-black text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          MiniSocial
        </Link>
        <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
          {user ? (
            <>
              <Link href="/discussions" className="p-2 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-lg transition-colors" title="Discussions">
                <MessageSquare size={20} />
              </Link>
              <Link href="/messages" className="p-2 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-lg transition-colors relative" title="Messages">
                <MessagesSquare size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              {(role === 'admin' || role === 'moderator') && (
                <Link href="/moderation" className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors" title="Moderation">
                  <Shield size={20} />
                </Link>
              )}
              <Link href={`/u/${user.user_metadata.username}`} className="hover:text-blue-600 transition-colors">Profile</Link>
              <button onClick={signOut} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full hover:bg-gray-200 transition-all">Logout</button>
            </>
          ) : (
            <>
              <Link href="/discussions" className="hover:text-blue-600 transition-colors">Discussions</Link>
              <Link href="/auth/login" className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-all shadow-sm shadow-blue-200">
                Login
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
