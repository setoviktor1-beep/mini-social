export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 p-4 sm:p-6 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="mt-4 h-10 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl" />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 animate-pulse">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800" />
              <div className="flex-1">
                <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="mt-2 h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="mt-4 h-4 w-full bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

