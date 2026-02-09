export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-56 h-48 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl animate-pulse" />
        <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 animate-pulse">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="mt-4 h-12 w-full bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="mt-3 h-12 w-full bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="mt-3 h-24 w-full bg-gray-100 dark:bg-gray-800 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

