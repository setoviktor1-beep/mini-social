'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'

const categoryOptions = [
  { value: 'general', label: 'General' },
  { value: 'help', label: 'Help' },
  { value: 'offtopic', label: 'Off-topic' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'news', label: 'News' },
]

export default function NewDiscussionPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('general')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
      } else {
        router.push('/auth/login')
      }
      setCheckingAuth(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (!content.trim()) {
      setError('Content is required.')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('discussions')
      .insert({
        user_id: userId,
        title: title.trim(),
        category,
        content: content.trim(),
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push(`/discussions/${data.id}`)
  }

  if (checkingAuth) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!userId) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/discussions"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-2xl font-black text-gray-900">New Discussion</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-1.5">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to discuss?"
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-colors"
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-bold text-gray-700 mb-1.5">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-colors bg-white"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div>
          <label htmlFor="content" className="block text-sm font-bold text-gray-700 mb-1.5">
            Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts in detail..."
            maxLength={5000}
            rows={8}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-colors resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{content.length}/5000</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !title.trim() || !content.trim()}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm shadow-blue-200"
          >
            {loading ? (
              'Creating...'
            ) : (
              <>
                <Send size={16} />
                Create Discussion
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
