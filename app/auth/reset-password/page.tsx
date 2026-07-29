'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/backend-client'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    if (!token) {
      setError('Reset password link is invalid or expired. Please request a new one.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.resetPassword({ password, token })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      setTimeout(() => {
        router.replace('/auth/login')
        router.refresh()
      }, 2000)
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-20 px-4 sm:px-0">
        <div className="p-6 sm:p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 text-center">
          <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-500" size={32} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Password Updated!</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">Redirecting you to the homepage...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-20 px-4 sm:px-0">
      <div className="p-6 sm:p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800">
        <h1 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Set New Password</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4 sm:mb-6 text-sm">Enter your new password below.</p>

        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-4">{error}</div>}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 min-h-[44px]"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 min-h-[44px]"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <button
            disabled={loading || !token}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-200 dark:shadow-blue-900/30 min-h-[44px]"
          >
            {loading ? 'Updating...' : !token ? 'Invalid link' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
