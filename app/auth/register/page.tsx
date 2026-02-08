'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Mail, CheckCircle } from 'lucide-react'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError('Username must be 3-20 characters, only letters, numbers and underscore.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    // Check if username is taken
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      setError('This username is already taken.')
      setLoading(false)
      return
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      window.location.origin

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase(),
          display_name: displayName || username,
        },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-green-500" size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Check your email!</h1>
        <p className="text-gray-500 mb-2">
          We sent a confirmation link to:
        </p>
        <p className="font-bold text-gray-900 mb-6 flex items-center justify-center gap-2">
          <Mail size={18} className="text-blue-500" />
          {email}
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
        </p>
        <Link
          href="/auth/login"
          className="block w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h1 className="text-2xl font-bold mb-2">Create Account</h1>
      <p className="text-gray-500 mb-6 text-sm">Join our small community today.</p>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="johndoe"
            required
          />
          <p className="text-xs text-gray-400 mt-1">3-20 characters, letters, numbers, underscore</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="John Doe"
            required
          />
        </div>
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
            minLength={6}
          />
        </div>
        <button
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-200"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account? <Link href="/auth/login" className="text-blue-600 font-semibold hover:underline">Login</Link>
      </p>
    </div>
  )
}
