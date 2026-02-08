import { createClient } from '@/lib/server-supabase'
import DiscussionCard from '@/components/DiscussionCard'
import Link from 'next/link'
import { Plus, MessageSquareText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const categories = [
  { key: 'all', label: 'All' },
  { key: 'general', label: 'General' },
  { key: 'help', label: 'Help' },
  { key: 'offtopic', label: 'Off-topic' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'news', label: 'News' },
]

interface DiscussionsPageProps {
  searchParams: { category?: string }
}

export default async function DiscussionsPage({ searchParams }: DiscussionsPageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const activeCategory = searchParams.category || 'all'

  let query = supabase
    .from('discussions')
    .select(`
      *,
      profiles:user_id(username, display_name),
      discussion_replies(count)
    `)
    .eq('status', 'active')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (activeCategory !== 'all') {
    query = query.eq('category', activeCategory)
  }

  const { data: discussions } = await query

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquareText size={28} className="text-blue-600" />
          <h1 className="text-2xl font-black text-gray-900">Discussions</h1>
        </div>
        {user && (
          <Link
            href="/discussions/new"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 flex items-center gap-2 text-sm"
          >
            <Plus size={18} />
            New Discussion
          </Link>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <Link
            key={cat.key}
            href={cat.key === 'all' ? '/discussions' : `/discussions?category=${cat.key}`}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
              activeCategory === cat.key
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Discussions list */}
      <div className="divide-y divide-gray-100 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {discussions && discussions.length > 0 ? (
          discussions.map((discussion) => (
            <DiscussionCard key={discussion.id} discussion={discussion} />
          ))
        ) : (
          <div className="p-16 text-center text-gray-400">
            <MessageSquareText size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-lg font-semibold text-gray-500">No discussions yet</p>
            <p className="text-sm mt-1">Be the first to start a conversation!</p>
          </div>
        )}
      </div>

      {/* Sign-in prompt */}
      {!user && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-700 text-center">
          <p>Sign in to start or join discussions.</p>
        </div>
      )}
    </div>
  )
}
