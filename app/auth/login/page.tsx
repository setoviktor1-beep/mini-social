'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, CheckCircle } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setError('Please confirm your email first. Check your inbox for the confirmation link.')
      } else if (error.message.includes('Invalid login credentials')) {
        setError('Wrong email or password. Please try again.')
      } else {
        setError(error.message)
      }
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
    })

    if (!error) {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  if (showReset) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        {resetSent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Check your email</h1>
            <p className="text-gray-500 mb-2">We sent a password reset link to:</p>
            <p className="font-bold text-gray-900 mb-6 flex items-center justify-center gap-2">
              <Mail size={18} className="text-blue-500" />
              {resetEmail}
            </p>
            <button
              onClick={() => { setShowReset(false); setResetSent(false) }}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
            <p className="text-gray-500 mb-6 text-sm">Enter your email and we&apos;ll send you a reset link.</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="john@example.com"
                  required
                />
              </div>
              <button
                disabled={resetLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <button
              onClick={() => setShowReset(false)}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-blue-600"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
      <p className="text-gray-500 mb-6 text-sm">Sign in to your account.</p>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="john@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="••••••••"
            required
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <button
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-200"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account? <Link href="/auth/register" className="text-blue-600 font-semibold hover:underline">Register</Link>
      </p>
    </div>
  )
}
