'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/backend-client'
import { Search, Users, FileText, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { lt } from 'date-fns/locale'
import Image from 'next/image'
import Link from 'next/link'

type Tab = 'users' | 'posts'

interface Profile {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_path: string | null
}

interface PostResult {
  id: string
  content: string
  created_at: string
  profiles: {
    username: string
    display_name: string
    avatar_path: string | null
  }
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [users, setUsers] = useState<Profile[]>([])
  const [posts, setPosts] = useState<PostResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState(false)

  useEffect(() => {
    const q = (searchParams.get('q') || '').trim()
    if (!q) return
    setQuery(q)
    setDebouncedQuery(q)
    setHasSearched(true)
    if (q.startsWith('#')) {
      setActiveTab('posts')
    }
  }, [searchParams])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 300)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  const performSearch = useCallback(async () => {
    if (!debouncedQuery) {
      setUsers([])
      setPosts([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    setHasSearched(true)
    setSearchError(false)

    try {
      if (activeTab === 'users') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${debouncedQuery}%,display_name.ilike.%${debouncedQuery}%`)
          .limit(20)

        if (error) throw error
        setUsers(data || [])
      } else {
        const { data, error } = await supabase
          .from('posts')
          .select('*, profiles:user_id(username, display_name, avatar_path)')
          .ilike('content', `%${debouncedQuery}%`)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) throw error
        setPosts((data as PostResult[]) || [])
      }
    } catch {
      setUsers([])
      setPosts([])
      setSearchError(true)
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, activeTab, supabase])

  useEffect(() => {
    performSearch()
  }, [performSearch])

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'users', label: 'Žmonės', icon: <Users size={16} /> },
    { key: 'posts', label: 'Įrašai', icon: <FileText size={16} /> },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-2">
        <Search size={24} className="text-blue-600 sm:w-7 sm:h-7" />
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">Paieška</h1>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none">
          <Search size={20} className="text-gray-400 dark:text-gray-500" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ieškokite žmonių arba įrašų..."
          className="w-full pl-11 sm:pl-14 pr-4 sm:pr-5 py-3 sm:py-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 transition-all dark:text-gray-200"
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-4 sm:pr-5 flex items-center">
            <Loader2 size={20} className="text-blue-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm font-semibold transition-colors min-h-[40px] ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/30'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* No query state */}
        {!debouncedQuery && !hasSearched && (
          <div className="p-10 sm:p-16 text-center">
            <Search size={40} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
            <p className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400">Raskite žmones arba įrašus</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Pradėkite rašyti paieškos laukelyje</p>
          </div>
        )}

        {/* Loading state */}
        {loading && debouncedQuery && (
          <div className="p-10 sm:p-16 text-center">
            <Loader2 size={32} className="mx-auto mb-3 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Ieškoma...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && searchError && (
          <div role="alert" className="p-10 sm:p-16 text-center">
            <p className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400 mb-3">Nepavyko atlikti paieškos.</p>
            <button
              onClick={performSearch}
              className="px-5 py-2.5 rounded-full font-semibold text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 min-h-[44px] transition-all"
            >
              Bandyti dar kartą
            </button>
          </div>
        )}

        {/* Users results */}
        {!loading && !searchError && hasSearched && activeTab === 'users' && (
          <>
            {users.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map((user) => (
                  <Link
                    key={user.id}
                    href={`/u/${user.username}`}
                    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left min-h-[64px]"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                      {user.avatar_path ? (
                        <Image
                          src={getAvatarUrl(user.avatar_path) || ''}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-base sm:text-lg font-bold text-blue-200 dark:text-blue-500">
                          {user.display_name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm sm:text-base">{user.display_name}</p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">@{user.username}</p>
                      {user.bio && (
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{user.bio}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-10 sm:p-16 text-center">
                <Users size={40} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
                <p className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400">Nieko nerasta</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Pabandykite kitą paieškos frazę</p>
              </div>
            )}
          </>
        )}

        {/* Posts results */}
        {!loading && !searchError && hasSearched && activeTab === 'posts' && (
          <>
            {posts.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="w-full p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left min-h-[64px]"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        {post.profiles.avatar_path ? (
                          <Image
                            src={getAvatarUrl(post.profiles.avatar_path) || ''}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-blue-200 dark:text-blue-500">
                            {post.profiles.display_name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">
                          {post.profiles.display_name}
                          <span className="font-normal text-gray-400 dark:text-gray-500 ml-2">
                            @{post.profiles.username}
                          </span>
                        </p>
                        <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm leading-relaxed break-words">
                          {post.content.length > 150
                            ? post.content.substring(0, 150) + '...'
                            : post.content}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: lt })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-10 sm:p-16 text-center">
                <FileText size={40} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
                <p className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400">Nieko nerasta</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Pabandykite kitą paieškos frazę</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
