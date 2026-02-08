'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'
import Link from 'next/link'

export default function ModerationPage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.push('/admin/reports'), 3000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Shield className="text-blue-600 mb-4" size={48} />
      <h1 className="text-2xl font-black text-gray-900 mb-2">Page Moved</h1>
      <p className="text-gray-500 mb-6">The moderation center has moved to the Admin Panel.</p>
      <Link href="/admin/reports" className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-blue-700 transition-colors">
        Go to Admin Reports
      </Link>
      <p className="text-xs text-gray-400 mt-4">Redirecting automatically in 3 seconds...</p>
    </div>
  )
}
