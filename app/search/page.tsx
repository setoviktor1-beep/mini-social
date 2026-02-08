'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Search, Users, FileText, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
  }
}

export default function SearchPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [users, setUsers] = useState<Profile[]>([])
  const [posts, setPosts] = useState<PostResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounce the query
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

  // Perform search when debouncedQuery or activeTab changes
  const performSearch = useCallback(async () => {
    if (!debouncedQuery) {
      setUsers([])
      setPosts([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    setHasSearched(true)
    const supabase = createClient()

    try {
      if (activeTab === 'users') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${debouncedQuery}%,display_name.ilike.%${debouncedQuery}%`)
          .limit(20)

        if (!error && data) {
          setUsers(data)
        } else {
          setUsers([])
        }
      } else {
        const { data, error } = await supabase
          .from('posts')
          .select('*, profiles:user_id(username, display_name)')
          .ilike('content', `%${debouncedQuery}%`)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(20)

        if (!error && data) {
          setPosts(data as PostResult[])
        } else {
          setPosts([])
        }
      }
    } catch {
      setUsers([])
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, activeTab])

  useEffect(() => {
    performSearch()
  }, [performSearch])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'users', label: 'Users', icon: <Users size={16} /> },
    { key: 'posts', label: 'Posts', icon: <FileText size={16} /> },
  ]

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex items-center gap-3 mb-2">
        <Search size={28} className="text-blue-600" />
        <h1 className="text-2xl font-black text-gray-900">Search</h1>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search size={20} className="text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users or posts..."
          className="w-full pl-14 pr-5 py-4 bg-gray-50 border border-gray-200 rounded-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 transition-all"
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-5 flex items-center">
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
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* No query state */}
        {!debouncedQuery && !hasSearched && (
          <div className="p-16 text-center">
            <Search size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-lg font-semibold text-gray-500">Search for users or posts</p>
            <p className="text-sm text-gray-400 mt-1">Type something above to get started</p>
          </div>
        )}

        {/* Loading state */}
        {loading && debouncedQuery && (
          <div className="p-16 text-center">
            <Loader2 size={32} className="mx-auto mb-3 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-500">Searching...</p>
          </div>
        )}

        {/* Users results */}
        {!loading && hasSearched && activeTab === 'users' && (
          <>
            {users.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => router.push(`/u/${user.username}`)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-blue-200">
                        {user.display_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 truncate">{user.display_name}</p>
                      <p className="text-sm text-gray-500 truncate">@{user.username}</p>
                      {user.bio && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{user.bio}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-16 text-center">
                <Users size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-lg font-semibold text-gray-500">No results found</p>
                <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
              </div>
            )}
          </>
        )}

        {/* Posts results */}
        {!loading && hasSearched && activeTab === 'posts' && (
          <>
            {posts.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => router.push(`/u/${post.profiles.username}`)}
                    className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <p className="font-bold text-gray-900 text-sm">
                      {post.profiles.display_name}
                      <span className="font-normal text-gray-400 ml-2">
                        @{post.profiles.username}
                      </span>
                    </p>
                    <p className="text-gray-700 mt-1 text-sm leading-relaxed">
                      {post.content.length > 150
                        ? post.content.substring(0, 150) + '...'
                        : post.content}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-16 text-center">
                <FileText size={40} className="mx-auto mb-3 text-gray-200" />
                <p className="text-lg font-semibold text-gray-500">No results found</p>
                <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
