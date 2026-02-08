'use client'

const colorMap: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  hidden: 'bg-yellow-50 text-yellow-700',
  deleted: 'bg-red-50 text-red-700',
  open: 'bg-red-50 text-red-700',
  reviewed: 'bg-blue-50 text-blue-700',
  closed: 'bg-gray-100 text-gray-600',
  suspended: 'bg-red-50 text-red-700',
  user: 'bg-gray-100 text-gray-600',
  moderator: 'bg-purple-50 text-purple-700',
  admin: 'bg-indigo-50 text-indigo-700',
}

export default function StatusBadge({ status }: { status: string }) {
  const colors = colorMap[status] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${colors}`}>
      {status}
    </span>
  )
}
