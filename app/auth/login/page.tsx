'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, CheckCircle } from 'lucide-react'
import { normalizeNextPath } from '@/lib/auth-redirect'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = normalizeNextPath(searchParams.get('next'))

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session) return
      router.replace(nextPath)
      router.refresh()
    })

    return () => {
      active = false
    }
  }, [nextPath, router, supabase])

  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    setResendStatus('idle')

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
      router.replace(nextPath)
      router.refresh()
    }
  }

  const handleResendConfirmation = async () => {
    if (!email || resendStatus === 'sending' || resendStatus === 'sent') return
    setResendStatus('sending')
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    })
    if (error) {
      setResendStatus('error')
      setError(`Nepavyko išsiųsti laiško: ${error.message}`)
    } else {
      setResendStatus('sent')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (resetLoading) return
    setResetLoading(true)
    setError('')
    setResetError('')

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      setResetError(error.message)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return
    setError('')
    setGoogleLoading(true)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  if (showReset) {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-20 px-4 sm:px-0">
        <div className="p-6 sm:p-10 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
          {resetSent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-500" size={32} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Check your email</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-2 text-sm sm:text-base">We sent a password reset link to:</p>
              <p className="font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center justify-center gap-2 text-sm sm:text-base break-all">
                <Mail size={18} className="text-blue-500 flex-shrink-0" />
                {resetEmail}
              </p>
              <button
                onClick={() => { setShowReset(false); setResetSent(false) }}
                className="w-full text-white py-3 rounded-full font-bold transition-colors min-h-[44px]"
                style={{ background: 'var(--accent-gradient)' }}
              >
                Back to Login
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Reset Password</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-4 sm:mb-6 text-sm">Enter your email and we&apos;ll send you a reset link.</p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] min-h-[44px]"
                    placeholder="john@example.com"
                    required
                  />
                </div>
                {resetError && (
                  <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                    {resetError}
                  </div>
                )}
                <button
                  disabled={resetLoading}
                  className="w-full text-white py-3 rounded-full font-bold disabled:opacity-50 transition-colors min-h-[44px]"
                  style={{ background: 'var(--accent-gradient)' }}
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <button
                onClick={() => setShowReset(false)}
                className="mt-4 w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 min-h-[44px]"
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-20 px-4 sm:px-0">
      <div className="p-6 sm:p-10 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
        <h1 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Welcome Back</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4 sm:mb-6 text-sm">Sign in to your account.</p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-4 space-y-2">
            <p>{error}</p>
            {error.includes('confirm your email') && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline disabled:opacity-50"
              >
                {resendStatus === 'sent' ? 'Laiškas išsiųstas dar kartą' : resendStatus === 'sending' ? 'Siunčiama...' : 'Siųsti patvirtinimo laišką dar kartą'}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] py-3 rounded-full font-semibold disabled:opacity-50 min-h-[44px]"
          >
            {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
          </button>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            <span>or</span>
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] min-h-[44px]"
              placeholder="john@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] min-h-[44px]"
              placeholder="••••••••"
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowReset(true)
                setResetSent(false)
                setResetError('')
                setResetEmail(email)
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] flex items-center"
            >
              Forgot password?
            </button>
          </div>
          <button
            disabled={loading}
            className="w-full text-white py-3 rounded-full font-bold disabled:opacity-50 transition-colors min-h-[44px]"
            style={{ background: 'var(--accent-gradient)' }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have an account? <Link href={`/auth/register?next=${encodeURIComponent(nextPath)}`} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Register</Link>
        </p>
      </div>
    </div>
  )
}
