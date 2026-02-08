import { createClient } from '@/lib/server-supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Pin, Lock, MessageSquare } from 'lucide-react'
import DiscussionReplyForm from './DiscussionReplyForm'

export const dynamic = 'force-dynamic'

const categoryConfig: Record<string, { label: string; bg: string; text: string }> = {
  general: { label: 'General', bg: 'bg-blue-50', text: 'text-blue-700' },
  help: { label: 'Help', bg: 'bg-green-50', text: 'text-green-700' },
  offtopic: { label: 'Off-topic', bg: 'bg-gray-100', text: 'text-gray-600' },
  feedback: { label: 'Feedback', bg: 'bg-purple-50', text: 'text-purple-700' },
  news: { label: 'News', bg: 'bg-orange-50', text: 'text-orange-700' },
}

interface DiscussionPageProps {
  params: { id: string }
}

export default async function DiscussionPage({ params }: DiscussionPageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch the discussion
  const { data: discussion, error } = await supabase
    .from('discussions')
    .select(`
      *,
      profiles:user_id(username, display_name)
    `)
    .eq('id', params.id)
    .eq('status', 'active')
    .single()

  if (error || !discussion) {
    notFound()
  }

  // Fetch replies
  const { data: replies } = await supabase
    .from('discussion_replies')
    .select(`
      *,
      profiles:user_id(username, display_name)
    `)
    .eq('discussion_id', discussion.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const cat = categoryConfig[discussion.category] || categoryConfig.general
  const discussionTimeAgo = formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/discussions"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Discussions
      </Link>

      {/* Discussion */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6">
          {/* Title and badges */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {discussion.is_pinned && (
              <Pin size={16} className="text-blue-600 flex-shrink-0" />
            )}
            <h1 className="text-2xl font-black text-gray-900">{discussion.title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cat.bg} ${cat.text}`}>
              {cat.label}
            </span>
            {discussion.is_locked && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 flex items-center gap-1">
                <Lock size={12} />
                Locked
              </span>
            )}
          </div>

          {/* Author info */}
          <div className="flex items-center gap-3 mb-5">
            <Link href={`/u/${discussion.profiles?.username}`} className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-blue-300">
                  {discussion.profiles?.display_name?.charAt(0).toUpperCase()}
                </span>
              </div>
            </Link>
            <div>
              <Link href={`/u/${discussion.profiles?.username}`} className="font-bold text-gray-900 hover:underline text-sm">
                {discussion.profiles?.display_name}
              </Link>
              <span className="text-gray-400 text-sm ml-2">@{discussion.profiles?.username}</span>
              <p className="text-xs text-gray-400">{discussionTimeAgo}</p>
            </div>
          </div>

          {/* Content */}
          <div className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
            {discussion.content}
          </div>
        </div>
      </div>

      {/* Replies section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare size={18} />
            {replies?.length || 0} {(replies?.length || 0) === 1 ? 'Reply' : 'Replies'}
          </h2>
        </div>

        {/* Reply list */}
        <div className="divide-y divide-gray-100">
          {replies && replies.length > 0 ? (
            replies.map((reply) => {
              const replyTime = formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })
              return (
                <div key={reply.id} className="p-5">
                  <div className="flex gap-3">
                    <Link href={`/u/${reply.profiles?.username}`} className="flex-shrink-0">
                      <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-300">
                          {reply.profiles?.display_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/u/${reply.profiles?.username}`} className="font-bold text-sm text-gray-900 hover:underline">
                          {reply.profiles?.display_name}
                        </Link>
                        <span className="text-gray-400 text-xs">@{reply.profiles?.username}</span>
                        <span className="text-gray-300 text-xs">·</span>
                        <span className="text-gray-400 text-xs">{replyTime}</span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-10 text-center text-gray-400 text-sm">
              No replies yet. Be the first to respond!
            </div>
          )}
        </div>

        {/* Reply form */}
        <div className="border-t border-gray-100">
          {user ? (
            discussion.is_locked ? (
              <div className="p-5 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                <Lock size={14} />
                This discussion is locked. No new replies can be added.
              </div>
            ) : (
              <DiscussionReplyForm discussionId={discussion.id} userId={user.id} />
            )
          ) : (
            <div className="p-5 text-center">
              <p className="text-gray-400 text-sm">
                <Link href="/auth/login" className="text-blue-600 hover:underline font-semibold">
                  Sign in
                </Link>{' '}
                to reply to this discussion.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
