import { createClient } from '@/lib/server-supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Pin, Lock, MessageSquare } from 'lucide-react'
import DiscussionReplyForm from './DiscussionReplyForm'
import DiscussionAdminActions from '@/components/DiscussionAdminActions'
import ParsedContent from '@/lib/parseContent'

export const dynamic = 'force-dynamic'

const categoryConfig: Record<string, { label: string; bg: string; text: string }> = {
  general: { label: 'General', bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  help: { label: 'Help', bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  offtopic: { label: 'Off-topic', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  feedback: { label: 'Feedback', bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  news: { label: 'News', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
}

interface DiscussionPageProps {
  params: { id: string }
}

export default async function DiscussionPage({ params }: DiscussionPageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const publicUrl = (path: string) =>
    supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl

  let currentUserRole: string | null = null
  if (user) {
    const { data: curProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    currentUserRole = curProfile?.role || null
  }
  const canModerate = currentUserRole === 'admin' || currentUserRole === 'moderator'

  const { data: discussion, error } = await supabase
    .from('discussions')
    .select(`
      *,
      profiles:user_id(username, display_name, avatar_path)
    `)
    .eq('id', params.id)
    .eq('status', 'active')
    .single()

  if (error || !discussion) {
    notFound()
  }

  const { data: replies } = await supabase
    .from('discussion_replies')
    .select(`
      *,
      profiles:user_id(username, display_name, avatar_path)
    `)
    .eq('discussion_id', discussion.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const cat = categoryConfig[discussion.category] || categoryConfig.general
  const discussionTimeAgo = formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back link */}
      <Link
        href="/discussions"
        className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-1 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back to Discussions
      </Link>

      {/* Discussion */}
      <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-4 sm:p-6">
          {/* Title and badges */}
          <div className="flex items-start gap-2 flex-wrap mb-3 sm:mb-4">
            {discussion.is_pinned && (
              <Pin size={16} className="text-blue-600 flex-shrink-0 mt-1" />
            )}
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 break-words">{discussion.title}</h1>
          </div>
          {canModerate && (
            <div className="mb-4 sm:mb-5">
              <DiscussionAdminActions
                discussionId={discussion.id}
                initialPinned={!!discussion.is_pinned}
                initialLocked={!!discussion.is_locked}
                canModerate={canModerate}
              />
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-4 sm:mb-5">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cat.bg} ${cat.text}`}>
              {cat.label}
            </span>
            {discussion.is_locked && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-1">
                <Lock size={12} />
                Locked
              </span>
            )}
          </div>

          {/* Author info */}
          <div className="flex items-center gap-3 mb-4 sm:mb-5">
            <Link href={`/u/${discussion.profiles?.username}`} className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center overflow-hidden">
                {discussion.profiles?.avatar_path ? (
                  <img
                    src={publicUrl(discussion.profiles.avatar_path)}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                ) : (
                  <span className="text-sm font-bold text-blue-300 dark:text-blue-500">
                    {discussion.profiles?.display_name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <Link href={`/u/${discussion.profiles?.username}`} className="font-bold text-gray-900 dark:text-gray-100 hover:underline text-sm">
                  {discussion.profiles?.display_name}
                </Link>
                <span className="text-gray-400 dark:text-gray-500 text-sm">@{discussion.profiles?.username}</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">{discussionTimeAgo}</p>
            </div>
          </div>

          {/* Content */}
          <div className="text-gray-800 dark:text-gray-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
            <ParsedContent content={discussion.content} />
          </div>
        </div>
      </div>

      {/* Replies section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm sm:text-base">
            <MessageSquare size={18} />
            {replies?.length || 0} {(replies?.length || 0) === 1 ? 'Reply' : 'Replies'}
          </h2>
        </div>

        {/* Reply list */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {replies && replies.length > 0 ? (
            replies.map((reply) => {
              const replyTime = formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })
              return (
                <div key={reply.id} className="p-3 sm:p-5">
                  <div className="flex gap-2 sm:gap-3">
                    <Link href={`/u/${reply.profiles?.username}`} className="flex-shrink-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center overflow-hidden">
                        {reply.profiles?.avatar_path ? (
                          <img
                            src={publicUrl(reply.profiles.avatar_path)}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <span className="text-xs font-bold text-blue-300 dark:text-blue-500">
                            {reply.profiles?.display_name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                        <Link href={`/u/${reply.profiles?.username}`} className="font-bold text-sm text-gray-900 dark:text-gray-100 hover:underline">
                          {reply.profiles?.display_name}
                        </Link>
                        <span className="text-gray-400 dark:text-gray-500 text-xs">@{reply.profiles?.username}</span>
                        <span className="text-gray-300 dark:text-gray-600 text-xs hidden sm:inline">&middot;</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs">{replyTime}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        <ParsedContent content={reply.content} />
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-8 sm:p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
              No replies yet. Be the first to respond!
            </div>
          )}
        </div>

        {/* Reply form */}
        <div className="border-t border-gray-100 dark:border-gray-800">
          {user ? (
            discussion.is_locked ? (
              <div className="p-4 sm:p-5 text-center text-gray-400 dark:text-gray-500 text-sm flex items-center justify-center gap-2">
                <Lock size={14} />
                This discussion is locked. No new replies can be added.
              </div>
            ) : (
              <DiscussionReplyForm discussionId={discussion.id} userId={user.id} />
            )
          ) : (
            <div className="p-4 sm:p-5 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                <Link href="/auth/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
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
