'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { X, Camera } from 'lucide-react'
import Image from 'next/image'

interface ProfileActionsProps {
  profileId: string
  currentUserId?: string
  isFollowing: boolean
  profile: {
    id: string
    display_name: string
    bio: string | null
    avatar_path: string | null
  }
}

export default function ProfileActions({ profileId, currentUserId, isFollowing: initialFollowing, profile }: ProfileActionsProps) {
  const supabase = createClient()
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const isOwner = currentUserId === profileId

  const handleFollow = async () => {
    if (!currentUserId) return
    setLoading(true)

    if (following) {
      await supabase.from('follows').delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profileId)
      setFollowing(false)
    } else {
      const { error } = await supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: profileId
      })
      if (!error) {
        setFollowing(true)
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
      bio: bio.trim() || null,
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
          className={`px-6 sm:px-8 py-2.5 rounded-full font-bold transition-all shadow-sm min-h-[44px] ${
            following
              ? 'border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-red-200 dark:hover:border-red-700 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100 dark:shadow-blue-900/30'
          }`}
        >
          {loading ? '...' : following ? 'Following' : 'Follow'}
        </button>
      )}
      {isOwner && (
        <>
          {showEditModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="font-bold text-lg sm:text-xl dark:text-gray-100">Edit Profile</h3>
                  <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Avatar upload */}
                  <div className="flex justify-center">
                    <label className="relative cursor-pointer group">
                      <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-200 dark:border-gray-700 group-hover:border-blue-400 transition-colors">
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
                          <span className="text-2xl font-bold text-blue-200 dark:text-blue-500">{displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full shadow-sm">
                        <Camera size={14} />
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && setAvatarFile(e.target.files[0])} />
                    </label>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100 bg-white dark:bg-gray-800 dark:text-gray-200 min-h-[44px]"
                      maxLength={50}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-1">Bio</label>
                    <textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 resize-none min-h-[80px] bg-white dark:bg-gray-800 dark:text-gray-200"
                      maxLength={160}
                      placeholder="Tell us about yourself..."
                    />
                    <p className="text-xs text-gray-400 text-right">{bio.length}/160</p>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[44px]"
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
