'use client'
import { createClient } from '@/lib/backend-client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Camera, Trash2, Loader2, Check, AlertCircle, Mail, KeyRound, Palette, Ban, Briefcase, MapPin } from 'lucide-react'
import Image from 'next/image'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import InviteButton from '@/components/InviteButton'
import AvatarCropModal from '@/components/AvatarCropModal'

interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_path: string | null
  role: string
  city: string | null
  country: string | null
  postal_code: string | null
  address_text: string | null
  business_name: string | null
  business_category: string | null
  business_description: string | null
  phone: string | null
  created_at: string
}

interface FormErrors {
  displayName?: string
  username?: string
  bio?: string
  avatar?: string
}

interface BlockedUserRow {
  id: string
  blocked_id: string
  created_at: string
  blocked:
    | {
        id: string
        username: string
        display_name: string | null
        avatar_path: string | null
      }
    | {
        id: string
        username: string
        display_name: string | null
        avatar_path: string | null
      }[]
    | null
}

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auth & profile state
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userEmail, setUserEmail] = useState('')

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  // Nextdoor features
  const [addressText, setAddressText] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('Lietuva')
  const [postalCode, setPostalCode] = useState('')
  const [addressLat, setAddressLat] = useState<number | null>(null)
  const [addressLng, setAddressLng] = useState<number | null>(null)
  const [userRadiusKm, setUserRadiusKm] = useState(5.0)
  const [travelMode, setTravelMode] = useState(false)
  const [travelAddressText, setTravelAddressText] = useState('')
  const [travelLat, setTravelLat] = useState<number | null>(null)
  const [travelLng, setTravelLng] = useState<number | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [businessCategory, setBusinessCategory] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [phone, setPhone] = useState('')

  // UI state
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChanging, setPasswordChanging] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRow[]>([])
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false)

  // Load user and profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login?next=/settings')
        return
      }
      setUserEmail(user.email || '')

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error || !profileData) {
        router.replace('/auth/login?next=/settings')
        return
      }

      setProfile(profileData)
      setDisplayName(profileData.display_name || '')
      setUsername(profileData.username || '')
      setBio(profileData.bio || '')
      setAvatarPath(profileData.avatar_path)
      setAddressText(profileData.address_text || '')
      setCity(profileData.city || '')
      setCountry(profileData.country || 'Lietuva')
      setPostalCode(profileData.postal_code || '')
      setAddressLat(profileData.address_lat ?? null)
      setAddressLng(profileData.address_lng ?? null)
      setUserRadiusKm(profileData.user_radius_km ?? 5.0)
      setTravelMode(profileData.travel_mode ?? false)
      setTravelAddressText(profileData.travel_address_text || '')
      setTravelLat(profileData.travel_lat ?? null)
      setTravelLng(profileData.travel_lng ?? null)
      setBusinessName(profileData.business_name || '')
      setBusinessCategory(profileData.business_category || '')
      setBusinessDescription(profileData.business_description || '')
      setPhone(profileData.phone || '')
      setLoading(false)
    }
    loadProfile()
  }, [])

  useEffect(() => {
    if (!profile) return
    const loadBlocked = async () => {
      setLoadingBlockedUsers(true)
      const { data } = await supabase
        .from('blocks')
        .select('id, blocked_id, created_at, blocked:blocked_id(id, username, display_name, avatar_path)')
        .eq('blocker_id', profile.id)
        .order('created_at', { ascending: false })
      setBlockedUsers(((data || []) as unknown as BlockedUserRow[]))
      setLoadingBlockedUsers(false)
    }
    loadBlocked()
  }, [profile?.id])

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }

  const handleUnblock = async (blockId: string) => {
    if (!profile) return
    await supabase.from('blocks').delete().eq('id', blockId).eq('blocker_id', profile.id)
    setBlockedUsers(prev => prev.filter(b => b.id !== blockId))
    router.refresh()
  }

  // Debounced username uniqueness check
  useEffect(() => {
    if (!profile) return
    if (username === profile.username) {
      setUsernameAvailable(null)
      return
    }
    if (username.length < 3) {
      setUsernameAvailable(null)
      return
    }
    const timeout = setTimeout(async () => {
      setCheckingUsername(true)
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .neq('id', profile.id)
        .maybeSingle()
      setUsernameAvailable(!data)
      setCheckingUsername(false)
    }, 500)
    return () => clearTimeout(timeout)
  }, [username, profile])

  // Auto-clear messages
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(''), 4000)
      return () => clearTimeout(t)
    }
  }, [successMessage])
  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(''), 5000)
      return () => clearTimeout(t)
    }
  }, [errorMessage])

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, avatar: 'Nuotrauka turi būti mažesnė nei 5MB' }))
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, avatar: 'Pasirinkite vaizdo failą' }))
      return
    }

    setErrors(prev => ({ ...prev, avatar: undefined }))
    setCropSrc(URL.createObjectURL(file))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCropSave = (blob: Blob) => {
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(blob))
    setRemoveAvatar(false)
    setCropSrc(null)
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
    setRemoveAvatar(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!displayName.trim()) {
      newErrors.displayName = 'Vardas yra privalomas'
    } else if (displayName.trim().length > 50) {
      newErrors.displayName = 'Vardas negali viršyti 50 simbolių'
    }

    const uname = username.trim().toLowerCase()
    if (!uname || uname.length < 3) {
      newErrors.username = 'Vartotojo vardas turi būti bent 3 simbolių'
    } else if (!/^[a-z0-9_]+$/.test(uname)) {
      newErrors.username = 'Vartotojo varde leidžiamos tik mažosios raidės, skaičiai ir _'
    } else if (usernameAvailable === false) {
      newErrors.username = 'Šis vartotojo vardas jau užimtas'
    }

    if (bio.length > 160) {
      newErrors.bio = 'Aprašymas negali viršyti 160 simbolių'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!profile) return
    if (!validate()) return

    setSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      let newAvatarPath = avatarPath

      // Handle avatar upload
      if (avatarFile) {
        // Delete old avatar if exists
        if (avatarPath) {
          await supabase.storage.from('post-images').remove([avatarPath])
        }

        const ext = avatarFile.name.split('.').pop() || 'jpg'
        const path = `${profile.id}/avatars/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(path, avatarFile)

        if (uploadError) {
          setErrorMessage('Nepavyko įkelti nuotraukos: ' + uploadError.message)
          setSaving(false)
          return
        }
        newAvatarPath = path
      }

      // Handle avatar removal
      if (removeAvatar && avatarPath) {
        await supabase.storage.from('post-images').remove([avatarPath])
        newAvatarPath = null
      }

      const canManageBusiness = ['pro', 'master', 'admin'].includes(profile.role)

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim() ? bio : null,
          avatar_path: newAvatarPath,
          city: city.trim() || null,
          country: country.trim() || null,
          postal_code: postalCode.trim() || null,
          address_text: addressText.trim() || null,
          address_lat: addressLat,
          address_lng: addressLng,
          user_radius_km: userRadiusKm,
          travel_mode: travelMode,
          travel_address_text: travelMode ? (travelAddressText.trim() || null) : null,
          travel_lat: travelMode ? travelLat : null,
          travel_lng: travelMode ? travelLng : null,
          ...(canManageBusiness
            ? {
                business_name: businessName.trim() || null,
                business_category: businessCategory.trim() || null,
                business_description: businessDescription.trim() || null,
              }
            : {}),
          phone: phone.trim() || null,
        })
        .eq('id', profile.id)

      if (updateError) {
        if (updateError.message.includes('unique') || updateError.message.includes('duplicate')) {
          setErrors(prev => ({ ...prev, username: 'Šis vartotojo vardas jau užimtas' }))
          setErrorMessage('Vartotojo vardas jau užimtas')
        } else {
          setErrorMessage('Nepavyko išsaugoti: ' + updateError.message)
        }
        setSaving(false)
        return
      }

      // Save location coordinates if available
      if (addressLat !== null && addressLng !== null) {
        const { error: locationError } = await supabase.rpc('update_profile_location', {
          user_id: profile.id,
          lat: addressLat,
          lng: addressLng,
        })

        if (locationError) {
          setErrorMessage('Nepavyko išsaugoti lokacijos: ' + locationError.message)
          setSaving(false)
          return
        }
      }

      // Update local state
      setAvatarPath(newAvatarPath)
      setAvatarFile(null)
      setAvatarPreview(null)
      setRemoveAvatar(false)
      setProfile(prev => prev ? {
        ...prev,
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() ? bio : null,
        avatar_path: newAvatarPath,
        city: city.trim() || null,
        country: country.trim() || null,
        postal_code: postalCode.trim() || null,
        address_text: addressText.trim() || null,
        ...(canManageBusiness
          ? {
              business_name: businessName.trim() || null,
              business_category: businessCategory.trim() || null,
              business_description: businessDescription.trim() || null,
            }
          : {}),
        phone: phone.trim() || null,
      } : null)

      // Update auth user metadata so navbar reflects new username
      await supabase.auth.updateUser({
        data: { username: username.trim().toLowerCase() }
      })

      setSuccessMessage('Profilis sėkmingai atnaujintas!')
      router.refresh()
    } catch (err) {
      setErrorMessage('Įvyko nenumatyta klaida')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (newPassword.length < 8) {
      setErrorMessage('Naujas slaptažodis turi būti bent 8 simbolių.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Nauji slaptažodžiai nesutampa.')
      return
    }

    setPasswordChanging(true)
    const { error } = await supabase.auth.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setPasswordChanging(false)

    if (error) {
      setErrorMessage('Nepavyko pakeisti slaptažodžio. Patikrinkite dabartinį slaptažodį.')
    } else {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccessMessage('Slaptažodis sėkmingai pakeistas.')
    }
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Ar tikrai norite visam laikui ištrinti paskyrą? Šio veiksmo atšaukti nebus galima.')
    if (!confirmed) return

    setDeletingAccount(true)
    setErrorMessage('')

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    })

    if (!res.ok) {
      setDeletingAccount(false)
      setErrorMessage('Nepavyko ištrinti paskyros. Susisiekite su palaikymo komanda.')
      return
    }

    await supabase.auth.signOut()
    router.replace('/auth/login')
    router.refresh()
  }

  // Current avatar URL from storage
  const currentAvatarUrl = avatarPath
    ? `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/post-images/${avatarPath}`
    : null

  // What to display in avatar circle (preview > existing > fallback)
  const displayAvatarSrc = avatarPreview
    ? avatarPreview
    : removeAvatar
      ? null
      : currentAvatarUrl

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {cropSrc && (
        <AvatarCropModal
          src={cropSrc}
          onSave={handleCropSave}
          onCancel={() => setCropSrc(null)}
        />
      )}
      {/* Toast Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-2xl flex items-center gap-2">
          <Check size={18} className="text-green-600 shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-2">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* ==================== PROFILE SECTION ==================== */}
      <div id="profile" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50">
          <h2 className="font-bold text-xl text-gray-900">Profilis</h2>
          <p className="text-sm text-gray-500 mt-0.5">Jūsų viešo profilio informacija</p>
        </div>
        <div className="p-6 space-y-6">

          {/* Avatar Upload */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">Profilio nuotrauka</label>
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-200 relative">
                  {displayAvatarSrc ? (
                    <Image src={displayAvatarSrc} alt="Avatar" fill sizes="80px" className="object-cover" unoptimized />
                  ) : (
                    <span className="text-2xl font-bold text-blue-200">
                      {displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-full hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Camera size={16} />
                    Įkelti nuotrauką
                  </button>
                  {(displayAvatarSrc) && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                      <Trash2 size={16} />
                      Pašalinti
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400">JPG, PNG, GIF arba WebP. Iki 5 MB.</p>
                {errors.avatar && (
                  <p className="text-xs text-red-500 font-medium">{errors.avatar}</p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarSelect}
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">Vardas</label>
            <input
              type="text"
              value={displayName}
              onChange={e => {
                setDisplayName(e.target.value)
                if (errors.displayName) setErrors(prev => ({ ...prev, displayName: undefined }))
              }}
              className={`w-full border rounded-xl px-4 py-2.5 outline-none transition-colors text-gray-900 text-slate-900 bg-white bg-white ${
                errors.displayName
                  ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-100'
                  : 'border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-100'
              }`}
              maxLength={50}
              placeholder="Jūsų vardas"
            />
            <div className="flex justify-between mt-1">
              {errors.displayName ? (
                <p className="text-xs text-red-500 font-medium">{errors.displayName}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-gray-400">{displayName.length}/50</p>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">Vartotojo vardas</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={e => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                  setUsername(val)
                  if (errors.username) setErrors(prev => ({ ...prev, username: undefined }))
                }}
                className={`w-full border rounded-xl pl-8 pr-10 py-2.5 outline-none transition-colors text-gray-900 text-slate-900 bg-white bg-white ${
                  errors.username
                    ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-100'
                    : 'border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-100'
                }`}
                placeholder="username"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingUsername && (
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <Check size={16} className="text-green-500" />
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <AlertCircle size={16} className="text-red-500" />
                )}
              </div>
            </div>
            <div className="flex justify-between mt-1">
              {errors.username ? (
                <p className="text-xs text-red-500 font-medium">{errors.username}</p>
              ) : usernameAvailable === true ? (
                <p className="text-xs text-green-600 font-medium">Vartotojo vardas laisvas</p>
              ) : usernameAvailable === false ? (
                <p className="text-xs text-red-500 font-medium">Vartotojo vardas jau užimtas</p>
              ) : (
                <p className="text-xs text-gray-400">Tik mažosios raidės, skaičiai ir _. Min 3 simboliai.</p>
              )}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">Aprašymas</label>
            <textarea
              value={bio}
              onChange={e => {
                setBio(e.target.value)
                if (errors.bio) setErrors(prev => ({ ...prev, bio: undefined }))
              }}
              className={`w-full border rounded-xl px-4 py-2.5 outline-none resize-none min-h-[100px] transition-colors text-gray-900 text-slate-900 bg-white bg-white ${
                errors.bio
                  ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-100'
                  : 'border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-100'
              }`}
              maxLength={160}
              placeholder="Papasakokite apie save"
            />
            <div className="flex justify-between mt-1">
              {errors.bio ? (
                <p className="text-xs text-red-500 font-medium">{errors.bio}</p>
              ) : (
                <span />
              )}
              <p className={`text-xs ${bio.length > 150 ? 'text-orange-500' : 'text-gray-400'}`}>
                {bio.length}/160
              </p>
            </div>
          </div>

          {/* Location & Pro Features Section */}
          <div className="pt-4 border-t border-gray-50 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Palette size={18} className="text-blue-500" />
                Vietovės ir Verslo Nustatymai
              </h3>
              <InviteButton />
            </div>

            {/* Subscription-controlled account role */}
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">Paskyros tipas</label>
              {['pro', 'master', 'admin'].includes(profile?.role || '') ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border-2 border-emerald-200 rounded-xl">
                  <span>💼</span>
                  <span className="font-bold text-sm text-emerald-700">
                    {profile?.role === 'admin'
                      ? 'Administratorius'
                      : profile?.role === 'master'
                        ? 'Verslo paskyra'
                        : 'Pro planas'}
                  </span>
                  <span className="ml-auto text-xs text-emerald-600">Aktyvi</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-blue-900">Kaimyno paskyra</p>
                    <p className="mt-1 text-xs text-blue-700">
                      Verslo funkcijos aktyvuojamos saugiai per prenumeratą.
                    </p>
                  </div>
                  <Link
                    href="/pricing"
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                  >
                    Peržiūrėti planus
                  </Link>
                </div>
              )}
            </div>

            {/* Address - editable to get coordinates */}
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">
                <MapPin size={14} className="inline mr-1 text-blue-500" />
                Tavo adresas
              </label>
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
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 bg-white text-gray-900 text-sm min-h-[44px]"
              />
              {addressText && !addressLat && (
                <p className="text-xs text-amber-600 mt-1">⚠ Koordinatės nerasta — naudok adresų paiešką, kad paslaugos veiktų pagal lokaciją.</p>
              )}
              {addressLat && (
                <p className="text-xs text-green-600 mt-1">✓ Koordinatės rastos</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Naudok automatinę paiešką koordinatėms gauti. Kelionėms naudok Travel Mode žemiau.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">Miestas</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 bg-white text-gray-900 text-sm min-h-[44px]"
                  placeholder="Lentvaris"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">Šalis</label>
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 bg-white text-gray-900 text-sm min-h-[44px]"
                  placeholder="Lietuva"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1.5">Pašto kodas</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={e => setPostalCode(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 bg-white text-gray-900 text-sm min-h-[44px]"
                  placeholder="LT-25100"
                />
              </div>
            </div>

            {/* Radius Slider */}
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">
                Matomumo spindulys
                <span className="ml-2 text-blue-500 font-black">
                  {userRadiusKm < 1 ? `${Math.round(userRadiusKm * 1000)} m` : `${userRadiusKm} km`}
                </span>
              </label>
              <input
                type="range"
                min={0.1}
                max={5}
                step={0.1}
                value={userRadiusKm}
                onChange={e => setUserRadiusKm(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>100 m</span>
                <span>1 km</span>
                <span>2.5 km</span>
                <span>5 km</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Matysi postus ir paslaugas tik iš vartotojų per {userRadiusKm < 1 ? `${Math.round(userRadiusKm * 1000)} m` : `${userRadiusKm} km`} nuo tavęs.
              </p>
            </div>

            {/* Travel Mode */}
            <div className="pt-2">
              <div className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✈️</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Kelionės režimas</p>
                    <p className="text-xs text-gray-500">Paslaugos rodomos iš kelionės vietos. Feed nesikeičia.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTravelMode(v => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${travelMode ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${travelMode ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              {travelMode && (
                <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-bold text-gray-700 block">Kelionės vieta</label>
                  <AddressAutocomplete
                    value={travelAddressText}
                    onChange={(addr, lat, lng) => {
                      setTravelAddressText(addr)
                      if (lat !== undefined && lng !== undefined) {
                        setTravelLat(lat)
                        setTravelLng(lng)
                      }
                    }}
                    placeholder="Pvz.: Kaunas, Lietuva"
                  />
                  {travelLat && (
                    <p className="text-xs text-blue-500 font-medium">
                      ✓ Vieta nustatyta — paslaugos rodomos iš šios vietos
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Business details are available only to managed business roles. */}
            {['pro', 'master', 'admin'].includes(profile?.role || '') && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
                <h4 className="font-bold text-emerald-700 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Briefcase size={16} />
                  Tavo Verslo Informacija
                </h4>
                
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Verslo pavadinimas / Vardas Pavardė</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 text-slate-900 bg-transparent outline-none focus:border-emerald-300 transition-colors placeholder:text-gray-400"
                    placeholder="Pvz.: Santechnikas Jonas"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Veiklos sritis (Kategorija)</label>
                  <select
                    value={businessCategory}
                    onChange={e => setBusinessCategory(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 text-slate-900 bg-transparent outline-none focus:border-emerald-300 transition-colors"
                  >
                    <option value="">Pasirinkite kategoriją...</option>
                    <option value="Maistas">Maistas</option>
                    <option value="Grožis">Grožis</option>
                    <option value="Auto">Auto</option>
                    <option value="Sveikata">Sveikata</option>
                    <option value="Remontas">Remontas / Santechnika / Elektra</option>
                    <option value="Kita">Kita (Pagalba, valymas, kt.)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Paslaugos aprašymas</label>
                  <textarea
                    value={businessDescription}
                    onChange={e => setBusinessDescription(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 text-slate-900 bg-transparent outline-none focus:border-emerald-300 transition-colors resize-none min-h-[80px] placeholder:text-gray-400"
                    placeholder="Trumpai apibūdinkite, kokias paslaugas teikiate (pvz., 'Taisau kranus, keičiu radiatorius, greitai atvykstu į vietą')."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Kontaktinis telefonas</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 text-slate-900 bg-transparent outline-none focus:border-emerald-300 transition-colors placeholder:text-gray-400"
                    placeholder="+370 600 00000"
                  />
                </div>

                <p className="text-[10px] text-gray-400 italic">
                  Šie duomenys bus matomi kaimynams, kai jie ieškos tavo kategorijos paslaugų.
                </p>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-2">
            {(successMessage || errorMessage) && (
              <div className={`mb-3 rounded-xl px-4 py-3 text-sm font-medium ${successMessage ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {successMessage || errorMessage}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-8 py-2.5 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-200 flex items-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Išsaugoma...' : 'Išsaugoti profilį'}
            </button>
          </div>
        </div>
      </div>

      {/* ==================== ACCOUNT SECTION ==================== */}
      <div id="account" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50">
          <h2 className="font-bold text-xl text-gray-900">Paskyros nustatymai</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tvarkykite savo paskyros nustatymus</p>
        </div>
        <div className="p-6 space-y-6">

          {/* Email (readonly) */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">
              <span className="flex items-center gap-2">
                <Mail size={16} />
                El. pašto adresas
              </span>
            </label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">
              Norėdami keisti el. pašto adresą, susisiekite su palaikymo komanda.
            </p>
          </div>

          {/* Change Password */}
          <form onSubmit={handlePasswordChange}>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">
              <span className="flex items-center gap-2">
                <KeyRound size={16} />
                Keisti slaptažodį
              </span>
            </label>
            <p className="mb-3 text-sm text-gray-500">
              Pakeitus slaptažodį, kitos aktyvios sesijos bus atjungtos.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Dabartinis slaptažodis"
                required
                className="min-h-[44px] rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-blue-400"
              />
              <input
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Naujas slaptažodis"
                minLength={8}
                required
                className="min-h-[44px] rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-blue-400"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Pakartokite slaptažodį"
                minLength={8}
                required
                className="min-h-[44px] rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-blue-400"
              />
            </div>
            <button
              type="submit"
              disabled={passwordChanging}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border-2 border-gray-200 px-6 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {passwordChanging && <Loader2 size={16} className="animate-spin" />}
              {passwordChanging ? 'Keičiama...' : 'Pakeisti slaptažodį'}
            </button>
          </form>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-red-800">Ištrinti paskyrą</h3>
                <p className="mt-1 text-sm text-red-700">
                  Paskyra ir su ja susieti profilio duomenys bus pašalinti visam laikui.
                </p>
              </div>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingAccount ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deletingAccount ? 'Trinama...' : 'Ištrinti'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== APPEARANCE SECTION ==================== */}
      <div id="appearance" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50">
          <h2 className="font-bold text-xl text-gray-900">Išvaizda</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tinkinkite, kaip atrodo Mini Social jums</p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 text-gray-400 py-8 justify-center">
            <Palette size={24} />
            <p className="text-sm font-medium">Temos nustatymai – jau greitai</p>
          </div>
        </div>
      </div>

      {/* ==================== BLOCKED USERS SECTION ==================== */}
      <div id="blocked" className="bg-white bg-white rounded-2xl shadow-sm shadow-sm border border-gray-100 border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50 border-slate-200">
          <h2 className="font-bold text-xl text-gray-900 text-slate-900">Užblokuoti vartotojai</h2>
          <p className="text-sm text-gray-500 text-slate-500 mt-0.5">Jūsų užblokuoti vartotojai nerodomi naujienlaištyje ir žinutėse</p>
        </div>
        <div className="p-6">
          {loadingBlockedUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-gray-100 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Ban size={22} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-500 text-slate-500">Nėra užblokuotų vartotojų</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Galite blokuoti vartotoją iš jo profilio puslapio</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((b) => {
                const u = Array.isArray(b.blocked) ? b.blocked[0] : b.blocked
                const avatarUrl = getAvatarUrl(u?.avatar_path || null)
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 sm:gap-4 p-3 rounded-2xl border border-gray-100 border-slate-200 bg-white bg-white"
                  >
                    <div className="w-11 h-11 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt="" fill sizes="44px" className="object-cover" />
                      ) : (
                        <span className="text-base font-bold text-blue-200 dark:text-blue-500">
                          {(u?.display_name || u?.username || '?')?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-slate-900 truncate text-sm sm:text-base">
                        {u?.display_name || 'Unknown user'}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 text-slate-500 truncate">
                        @{u?.username || 'unknown'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnblock(b.id)}
                      className="px-5 py-2.5 rounded-full font-bold text-sm border-2 border-gray-200 border-slate-200 text-gray-700 text-slate-600 hover:bg-gray-50 hover:bg-slate-50 transition-colors min-h-[44px]"
                    >
                      Atblokuoti
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
