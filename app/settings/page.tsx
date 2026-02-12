'use client'
import { createClient } from '@/lib/supabase'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Trash2, Loader2, Check, AlertCircle, Mail, KeyRound, Palette, Ban } from 'lucide-react'
import Image from 'next/image'

interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_path: string | null
  role: string
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

  // UI state
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [resetEmailSending, setResetEmailSending] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRow[]>([])
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false)

  // Load user and profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUserEmail(user.email || '')

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error || !profileData) {
        router.push('/auth/login')
        return
      }

      setProfile(profileData)
      setDisplayName(profileData.display_name || '')
      setUsername(profileData.username || '')
      setBio(profileData.bio || '')
      setAvatarPath(profileData.avatar_path)
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
      setErrors(prev => ({ ...prev, avatar: 'Image must be less than 5MB' }))
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, avatar: 'Please select an image file' }))
      return
    }

    setErrors(prev => ({ ...prev, avatar: undefined }))
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setRemoveAvatar(false)
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
      newErrors.displayName = 'Display name is required'
    } else if (displayName.trim().length > 50) {
      newErrors.displayName = 'Display name must be 50 characters or less'
    }

    const uname = username.trim().toLowerCase()
    if (!uname || uname.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    } else if (!/^[a-z0-9_]+$/.test(uname)) {
      newErrors.username = 'Username can only contain lowercase letters, numbers, and underscores'
    } else if (usernameAvailable === false) {
      newErrors.username = 'This username is already taken'
    }

    if (bio.length > 160) {
      newErrors.bio = 'Bio must be 160 characters or less'
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
        const path = `avatars/${profile.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(path, avatarFile)

        if (uploadError) {
          setErrorMessage('Failed to upload avatar: ' + uploadError.message)
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

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim() || null,
          avatar_path: newAvatarPath,
        })
        .eq('id', profile.id)

      if (updateError) {
        if (updateError.message.includes('unique') || updateError.message.includes('duplicate')) {
          setErrors(prev => ({ ...prev, username: 'This username is already taken' }))
          setErrorMessage('Username is already taken')
        } else {
          setErrorMessage('Failed to save: ' + updateError.message)
        }
        setSaving(false)
        return
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
        bio: bio.trim() || null,
        avatar_path: newAvatarPath,
      } : null)

      // Update auth user metadata so navbar reflects new username
      await supabase.auth.updateUser({
        data: { username: username.trim().toLowerCase() }
      })

      setSuccessMessage('Profile updated successfully!')
      router.refresh()
    } catch (err) {
      setErrorMessage('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!userEmail) return
    setResetEmailSending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setResetEmailSending(false)
    if (error) {
      setErrorMessage('Failed to send reset email: ' + error.message)
    } else {
      setResetEmailSent(true)
      setSuccessMessage('Password reset email sent! Check your inbox.')
    }
  }

  // Current avatar URL from storage
  const currentAvatarUrl = avatarPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${avatarPath}`
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
          <h2 className="font-bold text-xl text-gray-900">Profile</h2>
          <p className="text-sm text-gray-500 mt-0.5">Your public profile information</p>
        </div>
        <div className="p-6 space-y-6">

          {/* Avatar Upload */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">Profile Picture</label>
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
                    Upload Photo
                  </button>
                  {(displayAvatarSrc) && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400">JPG, PNG, GIF or WebP. Max 5MB.</p>
                {errors.avatar && (
                  <p className="text-xs text-red-500 font-medium">{errors.avatar}</p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => {
                setDisplayName(e.target.value)
                if (errors.displayName) setErrors(prev => ({ ...prev, displayName: undefined }))
              }}
              className={`w-full border rounded-xl px-4 py-2.5 outline-none transition-colors ${
                errors.displayName
                  ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-100'
                  : 'border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-100'
              }`}
              maxLength={50}
              placeholder="Your display name"
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
            <label className="text-sm font-bold text-gray-700 block mb-1.5">Username</label>
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
                className={`w-full border rounded-xl pl-8 pr-10 py-2.5 outline-none transition-colors ${
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
                <p className="text-xs text-green-600 font-medium">Username is available</p>
              ) : usernameAvailable === false ? (
                <p className="text-xs text-red-500 font-medium">Username is already taken</p>
              ) : (
                <p className="text-xs text-gray-400">Lowercase letters, numbers, and underscores only. Min 3 characters.</p>
              )}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={e => {
                setBio(e.target.value)
                if (errors.bio) setErrors(prev => ({ ...prev, bio: undefined }))
              }}
              className={`w-full border rounded-xl px-4 py-2.5 outline-none resize-none min-h-[100px] transition-colors ${
                errors.bio
                  ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-100'
                  : 'border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-100'
              }`}
              maxLength={160}
              placeholder="Tell us about yourself..."
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

          {/* Save Button */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-8 py-2.5 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-200 flex items-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* ==================== ACCOUNT SECTION ==================== */}
      <div id="account" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50">
          <h2 className="font-bold text-xl text-gray-900">Account</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your account settings</p>
        </div>
        <div className="p-6 space-y-6">

          {/* Email (readonly) */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">
              <span className="flex items-center gap-2">
                <Mail size={16} />
                Email Address
              </span>
            </label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">
              To change your email address, please contact support.
            </p>
          </div>

          {/* Change Password */}
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1.5">
              <span className="flex items-center gap-2">
                <KeyRound size={16} />
                Password
              </span>
            </label>
            <p className="text-sm text-gray-500 mb-3">
              We&apos;ll send a password reset link to your email address.
            </p>
            <button
              onClick={handlePasswordReset}
              disabled={resetEmailSending || resetEmailSent}
              className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 ${
                resetEmailSent
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {resetEmailSending && <Loader2 size={16} className="animate-spin" />}
              {resetEmailSent ? (
                <>
                  <Check size={16} />
                  Reset Email Sent
                </>
              ) : resetEmailSending ? (
                'Sending...'
              ) : (
                'Send Password Reset Email'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ==================== APPEARANCE SECTION ==================== */}
      <div id="appearance" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50">
          <h2 className="font-bold text-xl text-gray-900">Appearance</h2>
          <p className="text-sm text-gray-500 mt-0.5">Customize how Mini Social looks for you</p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 text-gray-400 py-8 justify-center">
            <Palette size={24} />
            <p className="text-sm font-medium">Theme settings coming soon</p>
          </div>
        </div>
      </div>

      {/* ==================== BLOCKED USERS SECTION ==================== */}
      <div id="blocked" className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50 dark:border-gray-800">
          <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">Blocked Users</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">People you blocked won&apos;t show up in your feed or messages</p>
        </div>
        <div className="p-6">
          {loadingBlockedUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Ban size={22} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No blocked users</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">You can block someone from their profile page</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((b) => {
                const u = Array.isArray(b.blocked) ? b.blocked[0] : b.blocked
                const avatarUrl = getAvatarUrl(u?.avatar_path || null)
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 sm:gap-4 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
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
                      <p className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm sm:text-base">
                        {u?.display_name || 'Unknown user'}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                        @{u?.username || 'unknown'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnblock(b.id)}
                      className="px-5 py-2.5 rounded-full font-bold text-sm border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
                    >
                      Unblock
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
