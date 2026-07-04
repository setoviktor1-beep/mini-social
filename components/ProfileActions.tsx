'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { X, Camera } from 'lucide-react'
import Image from 'next/image'

interface ProfileActionsProps {
  profileId: string
  currentUserId?: string
  isFollowing: boolean
  initialFollowersCount: number
  profile: {
    id: string
    display_name: string
    bio: string | null
    avatar_path: string | null
  }
}

export default function ProfileActions({
  profileId,
  currentUserId,
  isFollowing: initialFollowing,
  initialFollowersCount,
  profile,
}: ProfileActionsProps) {
  const supabase = createClient()
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [loading, setLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const isOwner = currentUserId === profileId

  useEffect(() => {
    setFollowing(initialFollowing)
  }, [initialFollowing])

  useEffect(() => {
    setFollowersCount(initialFollowersCount)
  }, [initialFollowersCount])

  const syncFollowersCount = (nextCount: number) => {
    setFollowersCount(nextCount)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('profile-follow-count', {
        detail: {
          profileId,
          followersCount: nextCount,
        },
      }))
    }
  }

  const handleFollow = async () => {
    if (!currentUserId || loading) return
    setLoading(true)

    if (following) {
      const { error } = await supabase.from('follows').delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profileId)
      if (!error) {
        setFollowing(false)
        syncFollowersCount(Math.max(0, followersCount - 1))
      }
    } else {
      const { error } = await supabase.from('follows').upsert({
        follower_id: currentUserId,
        following_id: profileId
      }, {
        onConflict: 'follower_id,following_id',
        ignoreDuplicates: true,
      })
      if (!error) {
        setFollowing(true)
        syncFollowersCount(followersCount + 1)
        await supabase.from('notifications').insert({
          user_id: profileId,
          actor_id: currentUserId,
          type: 'follow',
          target_id: currentUserId,
          target_type: 'user',
        })
      }
    }

    setLoading(false)
    router.refresh()
  }

  const handleSaveProfile = async () => {
    if (!currentUserId) return
    setSaving(true)

    let avatarPath = profile.avatar_path

    if (avatarFile) {
      const path = `avatars/${currentUserId}/${Date.now()}_${avatarFile.name}`
      const { error: uploadError } = await supabase.storage.from('post-images').upload(path, avatarFile)
      if (!uploadError) {
        avatarPath = path
      }
    }

    await supabase.from('profiles').update({
      display_name: displayName.trim() || 'User',
      bio: bio.trim() ? bio : null,
      avatar_path: avatarPath
    }).eq('id', currentUserId)

    setSaving(false)
    setShowEditModal(false)
    router.refresh()
  }

  if (!currentUserId) return null

  return (
    <div className="flex gap-2 sm:gap-3">
      {!isOwner && (
        <button
          onClick={handleFollow}
          disabled={loading}
          className={`px-6 sm:px-8 py-2.5 rounded-full font-bold transition-all shadow-sm min-h-[44px] text-sm ${
            following
              ? 'border-2 border-slate-300 text-slate-700 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
              : 'bg-[#1A1A2E] text-white hover:bg-[#16213E] hover:shadow-md'
          }`}
        >
          {loading ? '...' : following ? 'Following' : 'Follow'}
        </button>
      )}
      {isOwner && (
        <>
          {showEditModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
              <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="font-bold text-lg sm:text-xl text-slate-900">Edit Profile</h3>
                  <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Avatar upload */}
                  <div className="flex justify-center">
                    <label className="relative cursor-pointer group">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center overflow-hidden border-2 border-slate-200 group-hover:border-blue-400 transition-colors ring-2 ring-white shadow-md">
                        {avatarFile ? (
                          <Image
                            src={URL.createObjectURL(avatarFile)}
                            className="w-full h-full object-cover"
                            alt=""
                            width={80}
                            height={80}
                            unoptimized
                          />
                        ) : profile.avatar_path ? (
                          <Image
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${profile.avatar_path}`}
                            className="w-full h-full object-cover"
                            alt=""
                            width={80}
                            height={80}
                          />
                        ) : (
                          <span className="text-2xl font-bold text-blue-600">{displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full shadow-sm">
                        <Camera size={14} />
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && setAvatarFile(e.target.files[0])} />
                    </label>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 bg-slate-50 text-slate-800 min-h-[44px] transition-all"
                      maxLength={50}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-slate-700 block mb-1">Bio</label>
                    <textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 resize-none min-h-[80px] bg-slate-50 text-slate-800 transition-all"
                      maxLength={160}
                      placeholder="Tell us about yourself..."
                    />
                    <p className="text-xs text-slate-400 text-right">{bio.length}/160</p>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="w-full bg-[#1A1A2E] text-white py-2.5 rounded-full font-bold hover:bg-[#16213E] disabled:opacity-50 transition-all min-h-[44px] shadow-sm hover:shadow-md"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
