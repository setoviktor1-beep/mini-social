import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 p-8 sm:p-12 text-center">
      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">404</p>
      <h1 className="mt-2 text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100">Page not found</h1>
      <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-gray-400">
        The page you&apos;re looking for doesn&apos;t exist, or it moved.
      </p>
      <div className="mt-6 flex justify-center gap-3 flex-wrap">
        <Link
          href="/"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-blue-700 transition-colors min-h-[44px] inline-flex items-center"
        >
          Go home
        </Link>
        <Link
          href="/search"
          className="border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2.5 rounded-full font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px] inline-flex items-center"
        >
          Search
        </Link>
      </div>
    </div>
  )
}

