'use client'

const colorMap: Record<string, string> = {
  active: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  hidden: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  deleted: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  open: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  reviewed: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  closed: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  suspended: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  user: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  moderator: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  admin: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
}

export default function StatusBadge({ status }: { status: string }) {
  const colors = colorMap[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${colors}`}>
      {status}
    </span>
  )
}
