'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { X, Camera } from 'lucide-react'

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
      await supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: profileId
      })
      setFollowing(true)
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
    <div className="flex gap-3">
      {!isOwner && (
        <button
          onClick={handleFollow}
          disabled={loading}
          className={`px-8 py-2.5 rounded-full font-bold transition-all shadow-sm ${
            following
              ? 'border-2 border-gray-200 text-gray-700 hover:border-red-200 hover:text-red-600 hover:bg-red-50'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
          }`}
        >
          {loading ? '...' : following ? 'Following' : 'Follow'}
        </button>
      )}
      {isOwner && (
        <>
          <button
            onClick={() => setShowEditModal(true)}
            className="border-2 border-gray-200 text-gray-700 px-8 py-2.5 rounded-full font-bold hover:bg-gray-50 transition-all"
          >
            Edit Profile
          </button>

          {showEditModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
              <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-xl">Edit Profile</h3>
                  <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Avatar upload */}
                  <div className="flex justify-center">
                    <label className="relative cursor-pointer group">
                      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-200 group-hover:border-blue-400 transition-colors">
                        {avatarFile ? (
                          <img src={URL.createObjectURL(avatarFile)} className="w-full h-full object-cover" alt="" />
                        ) : profile.avatar_path ? (
                          <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${profile.avatar_path}`} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-2xl font-bold text-blue-200">{displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full shadow-sm">
                        <Camera size={14} />
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && setAvatarFile(e.target.files[0])} />
                    </label>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
                      maxLength={50}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">Bio</label>
                    <textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-300 resize-none min-h-[80px]"
                      maxLength={160}
                      placeholder="Tell us about yourself..."
                    />
                    <p className="text-xs text-gray-400 text-right">{bio.length}/160</p>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
