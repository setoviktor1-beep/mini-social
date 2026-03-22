'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string

  useEffect(() => {
    if (code) {
      localStorage.setItem('referral_code', code)
    }
    const timer = setTimeout(() => {
      router.push('/auth/register')
    }, 2500)
    return () => clearTimeout(timer)
  }, [code, router])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
          <span className="text-4xl">👋</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Jus pakvietė draugas!
        </h1>
        <p className="text-[var(--text-secondary)] text-lg leading-relaxed">
          Registruokitės ir prisijunkite prie bendruomenės.
        </p>
        <p className="text-sm text-[var(--text-tertiary)]">
          Nukreipiame į registraciją...
        </p>
        <Link
          href="/auth/register"
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 dark:shadow-blue-900/30"
        >
          Registruotis dabar
        </Link>
      </div>
    </div>
  )
}
