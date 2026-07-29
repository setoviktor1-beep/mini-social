import { createClient } from '@/lib/backend-server'
import DiscussionCard from '@/components/DiscussionCard'
import Link from 'next/link'
import { Plus, MessageSquareText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const categories = [
  { key: 'all', label: 'Visi' },
  { key: 'general', label: 'Bendras' },
  { key: 'help', label: 'Pagalba' },
  { key: 'offtopic', label: 'Laisvalaikis' },
  { key: 'feedback', label: 'Atsiliepimai' },
  { key: 'news', label: 'Naujienos' },
]

interface DiscussionsPageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function DiscussionsPage(props: DiscussionsPageProps) {
  const searchParams = await props.searchParams;
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <MessageSquareText size={24} className="text-blue-600 sm:w-7 sm:h-7" />
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">Diskusijos</h1>
        </div>
        {user && (
          <Link
            href="/discussions/new"
            className="bg-blue-600 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 dark:shadow-blue-900/30 flex items-center gap-1.5 sm:gap-2 text-sm min-h-[44px]"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nauja diskusija</span>
            <span className="sm:hidden">Nauja</span>
          </Link>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
        {categories.map((cat) => (
          <Link
            key={cat.key}
            href={cat.key === 'all' ? '/discussions' : `/discussions?category=${cat.key}`}
            className={`px-3 sm:px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors min-h-[40px] flex items-center ${
              activeCategory === cat.key
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/30'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Discussions list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        {discussions && discussions.length > 0 ? (
          discussions.map((discussion) => (
            <DiscussionCard key={discussion.id} discussion={discussion} />
          ))
        ) : (
          <div className="p-10 sm:p-16 text-center text-gray-400 dark:text-gray-500">
            <MessageSquareText size={40} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
            <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">Diskusijų dar nėra</p>
            <p className="text-sm mt-1">Būk pirmas ir pradėk pokalbį!</p>
          </div>
        )}
      </div>

      {/* Sign-in prompt */}
      {!user && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-4 rounded-xl text-blue-700 dark:text-blue-300 text-center">
          <p>Prisijunkite, kad galėtumėte pradėti ar dalyvauti diskusijose.</p>
        </div>
      )}
    </div>
  )
}
