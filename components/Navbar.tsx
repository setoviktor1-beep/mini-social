'use client'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
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
      }
    })
  }, [])

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
        <div className="flex items-center gap-5 text-sm font-bold text-gray-600">
          {user ? (
            <>
              {role === 'admin' && (
                <Link href="/moderation" className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors" title="Moderation">
                  <Shield size={20} />
                </Link>
              )}
              <Link href={`/u/${user.user_metadata.username}`} className="hover:text-blue-600 transition-colors">Profile</Link>
              <button onClick={signOut} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full hover:bg-gray-200 transition-all">Logout</button>
            </>
          ) : (
            <Link href="/auth/login" className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-all shadow-sm shadow-blue-200">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
