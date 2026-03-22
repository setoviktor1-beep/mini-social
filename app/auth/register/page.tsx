'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, MapPin } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [addressText, setAddressText] = useState('')
  const [addressLat, setAddressLat] = useState<number | null>(null)
  const [addressLng, setAddressLng] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError('Vartotojo vardas turi būti 3-20 simbolių (raidės, skaičiai, _).')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Slaptažodis turi būti bent 6 simboliai.')
      setLoading(false)
      return
    }

    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      setError('Šis vartotojo vardas jau užimtas.')
      setLoading(false)
      return
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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
      return
    }

    // Save address if provided
    if (signUpData?.user && addressText && addressLat !== null && addressLng !== null) {
      await supabase
        .from('profiles')
        .update({
          address_text: addressText,
          address_lat: addressLat,
          address_lng: addressLng,
        })
        .eq('id', signUpData.user.id)

      await supabase.rpc('update_profile_location', {
        user_id: signUpData.user.id,
        lat: addressLat,
        lng: addressLng,
      })
    }

    // Handle referral code if present
    if (signUpData?.user) {
      const referralCode = localStorage.getItem('referral_code')
      if (referralCode) {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', referralCode)
          .maybeSingle()

        if (referrer) {
          await supabase
            .from('profiles')
            .update({ referred_by: referrer.id })
            .eq('id', signUpData.user.id)
        }
        localStorage.removeItem('referral_code')
      }
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 1500)
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setGoogleLoading(true)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl}/auth/callback?next=/` },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-10 sm:mt-20 px-4 sm:px-0">
        <div className="p-6 sm:p-10 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] text-center">
          <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-500" size={32} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-2 text-[var(--text-primary)]">Sveiki atvykę į MiniSocial!</h1>
          <p className="text-[var(--text-secondary)] mb-6 text-sm sm:text-base">
            Paskyra sukurta. Nukreipiame jus...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-20 px-4 sm:px-0">
      <div className="p-6 sm:p-10 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
        <h1 className="text-xl sm:text-2xl font-bold mb-2 text-[var(--text-primary)]">Sukurti paskyrą</h1>
        <p className="text-[var(--text-secondary)] mb-4 sm:mb-6 text-sm">Prisijunkite prie savo kaimynų bendruomenės.</p>

        {error && (
          <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] py-3 rounded-full font-semibold disabled:opacity-50 min-h-[44px]"
          >
            {googleLoading ? 'Jungiamasi...' : 'Tęsti su Google'}
          </button>

          <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            <span>arba</span>
            <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Vartotojo vardas</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
              placeholder="vardenis"
              required
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-1">3-20 simbolių, tik raidės, skaičiai, _</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Vardas</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
              placeholder="Vardenis Pavardenis"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">El. paštas</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
              placeholder="vardas@gmail.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Slaptažodis</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">
              <MapPin size={14} className="inline mr-1 text-blue-400" />
              Jūsų rajonas / Adresas
              <span className="text-[var(--text-tertiary)] font-normal ml-1">(neprivaloma)</span>
            </label>
            <AddressAutocomplete
              value={addressText}
              onChange={(addr, lat, lng) => {
                setAddressText(addr)
                if (lat !== undefined && lng !== undefined) {
                  setAddressLat(lat)
                  setAddressLng(lng)
                }
              }}
              placeholder="Pvz.: Pilaitė, Vilnius"
              className="w-full border border-[var(--border-subtle)] rounded-xl pl-4 pr-4 py-2.5 text-[var(--text-primary)] bg-[var(--bg-input)] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors placeholder:text-[var(--text-tertiary)] min-h-[44px]"
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Reikalinga, kad matytumėte kaimynų įrašus ir paslaugas savo spinduliu.
            </p>
          </div>

          <button
            disabled={loading}
            className="w-full text-white py-3 rounded-full font-bold disabled:opacity-50 transition-colors min-h-[44px]"
            style={{ background: 'var(--accent-gradient)' }}
          >
            {loading ? 'Kuriama paskyra...' : 'Registruotis'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Jau turite paskyrą?{' '}
          <Link href="/auth/login" className="text-blue-400 font-semibold hover:underline">
            Prisijungti
          </Link>
        </p>
      </div>
    </div>
  )
}
