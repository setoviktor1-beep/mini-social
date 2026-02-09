export default function Loading() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 p-6 sm:p-8 animate-pulse">
      <div className="h-5 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

