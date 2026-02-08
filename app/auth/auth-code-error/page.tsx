'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

export default function AuthCodeErrorPage() {
  const sp = useSearchParams()

  const details = useMemo(() => {
    const error = sp.get('error') || ''
    const errorCode = sp.get('error_code') || sp.get('code') || ''
    const desc = sp.get('error_description') || ''
    return { error, errorCode, desc }
  }, [sp])

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-sm border border-gray-100 space-y-4">
      <h1 className="text-2xl font-black">Link issue</h1>
      <p className="text-gray-600 text-sm">
        This usually happens when the email link is expired, already used, or points to the wrong domain.
      </p>

      {(details.error || details.errorCode || details.desc) && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          <div className="font-bold mb-1">Details</div>
          <div className="break-words">error: {details.error || '—'}</div>
          <div className="break-words">code: {details.errorCode || '—'}</div>
          <div className="break-words">description: {details.desc || '—'}</div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Link href="/auth/login" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-center hover:bg-blue-700 transition-colors">
          Go to login
        </Link>
        <Link href="/auth/register" className="w-full bg-gray-100 text-gray-800 py-3 rounded-xl font-bold text-center hover:bg-gray-200 transition-colors">
          Create account again
        </Link>
      </div>

      <p className="text-xs text-gray-500">
        If your email confirmation link opens <span className="font-bold">localhost</span>, you likely signed up while running the app locally.
        Sign up again on the Vercel domain to get a new link.
      </p>
    </div>
  )
}

