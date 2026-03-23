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
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('Lietuva')
  const [postalCode, setPostalCode] = useState('')
  const [addressText, setAddressText] = useState('')
  const [addressLat, setAddressLat] = useState<number | null>(null)
  const [addressLng, setAddressLng] = useState<number | null>(null)
  const [manualAddress, setManualAddress] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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

    if (!addressText.trim()) {
      setError('Prašome nurodyti adresą.')
      setLoading(false)
      return
    }

    if (!city.trim()) {
      setError('Prašome nurodyti miestą.')
      setLoading(false)
      return
    }

    if (!country.trim()) {
      setError('Prašome nurodyti šalį.')
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

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase(),
          display_name: fullName,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (signUpData?.user) {
      const profilePayload = {
        id: signUpData.user.id,
        username: username.toLowerCase(),
        display_name: fullName,
        phone,
        city: city.trim(),
        country: country.trim(),
        postal_code: postalCode.trim(),
        address_text: addressText.trim(),
        address_lat: addressLat,
        address_lng: addressLng,
      }

      const { data: updatedProfile, error: updateProfileError } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', signUpData.user.id)
        .select('id')

      if (updateProfileError) {
        setError(`Nepavyko išsaugoti profilio: ${updateProfileError.message}`)
        setLoading(false)
        return
      }

      if (!updatedProfile || updatedProfile.length === 0) {
        const { error: insertProfileError } = await supabase
          .from('profiles')
          .insert(profilePayload)

        if (insertProfileError) {
          setError(`Nepavyko išsaugoti profilio: ${insertProfileError.message}`)
          setLoading(false)
          return
        }
      }

      if (addressLat !== null && addressLng !== null) {
        const { error: locationError } = await supabase.rpc('update_profile_location', {
          user_id: signUpData.user.id,
          lat: addressLat,
          lng: addressLng,
        })

        if (locationError) {
          setError(`Nepavyko išsaugoti lokacijos: ${locationError.message}`)
          setLoading(false)
          return
        }
      }

      // Handle referral code
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
    <div className="max-w-md mx-auto mt-10 sm:mt-20 px-4 sm:px-0 pb-10">
      <div className="p-6 sm:p-10 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
        <h1 className="text-xl sm:text-2xl font-bold mb-2 text-[var(--text-primary)]">Sukurti paskyrą</h1>
        <p className="text-[var(--text-secondary)] mb-6 text-sm">Prisijunkite prie savo kaimynų bendruomenės.</p>

        {error && (
          <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Vardas ir pavardė</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
              placeholder="Vardenis Pavardenis"
              required
            />
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
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Telefono numeris</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
              placeholder="+370 600 00000"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Miestas</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
                placeholder="Lentvaris"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Šalis</label>
              <input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
                placeholder="Lietuva"
                required
              />
            </div>
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

          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">
              <MapPin size={14} className="inline mr-1 text-blue-400" />
              Adresas
            </label>
            {manualAddress ? (
              <>
                <input
                  type="text"
                  value={addressText}
                  onChange={e => {
                    setAddressText(e.target.value)
                    setAddressLat(null)
                    setAddressLng(null)
                  }}
                  placeholder="Pvz.: Gedimino pr. 1, Vilnius"
                  className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setManualAddress(false)}
                  className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Naudoti adreso paiešką
                </button>
              </>
            ) : (
              <>
                <AddressAutocomplete
                  value={addressText}
                  onChange={(addr, lat, lng) => {
                    setAddressText(addr)
                    if (lat !== undefined && lng !== undefined) {
                      setAddressLat(lat)
                      setAddressLng(lng)
                    } else {
                      setAddressLat(null)
                      setAddressLng(null)
                    }
                  }}
                  placeholder="Pvz.: Gedimino pr. 1, Vilnius"
                  className="w-full border border-[var(--border-subtle)] rounded-xl pl-4 pr-4 py-2.5 text-[var(--text-primary)] bg-[var(--bg-input)] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors placeholder:text-[var(--text-tertiary)] min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setManualAddress(true)
                    setAddressLat(null)
                    setAddressLng(null)
                  }}
                  className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Įvesti adresą rankiniu būdu
                </button>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Pašto kodas</label>
            <input
              type="text"
              value={postalCode}
              onChange={e => setPostalCode(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] rounded-xl outline-none transition-all bg-[var(--bg-input)] text-[var(--text-primary)] min-h-[44px]"
              placeholder="LT-01001"
              required
            />
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
