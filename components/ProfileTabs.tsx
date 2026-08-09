'use client'
import { useState } from 'react'
import PostCard from '@/components/PostCard'

type Tab = 'posts' | 'media' | 'reposts'

export default function ProfileTabs({
  posts,
  repostedPosts,
  currentUserId,
  currentUserRole,
}: {
  posts: any[]
  repostedPosts: any[]
  currentUserId?: string
  currentUserRole?: string
}) {
  const [tab, setTab] = useState<Tab>('posts')
  const mediaPosts = posts.filter((p) => Array.isArray(p.post_media) && p.post_media.length > 0)

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'posts', label: 'Įrašai', count: posts.length },
    { key: 'media', label: 'Medija', count: mediaPosts.length },
    { key: 'reposts', label: 'Pakartota', count: repostedPosts.length },
  ]

  const activePosts = tab === 'posts' ? posts : tab === 'media' ? mediaPosts : repostedPosts

  return (
    <div className="divide-y divide-slate-100 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
      <div role="tablist" aria-label="Profilio skiltys" className="flex border-b border-slate-50">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3.5 text-center text-sm font-semibold transition-colors min-h-[44px] ${
              tab === t.key ? 'text-slate-900 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs font-normal text-slate-400">{t.count}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activePosts.map((post: any) => (
          <PostCard key={post.feed_key || post.id} post={post} currentUserId={currentUserId} currentUserRole={currentUserRole} />
        ))}
        {activePosts.length === 0 && (
          <div className="p-10 sm:p-16 text-center">
            <p className="text-slate-500 font-medium">
              {tab === 'media' ? 'Medijos įrašų dar nėra.' : tab === 'reposts' ? 'Pakartotinių įrašų dar nėra.' : 'Šis vartotojas dar nieko nepaskelbė.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
