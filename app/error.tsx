'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) {
  const { error, reset } = props

  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 p-8 sm:p-12">
      <p className="text-sm font-bold text-red-600 dark:text-red-400">Something went wrong</p>
      <h1 className="mt-2 text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100">We hit an error</h1>
      <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-gray-400">
        Try again. If it keeps happening, go back home.
      </p>

      <div className="mt-6 flex gap-3 flex-wrap">
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2.5 rounded-full font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px] inline-flex items-center"
        >
          Home
        </Link>
      </div>

      {process.env.NODE_ENV !== 'production' && (
        <pre className="mt-6 text-xs overflow-auto bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-gray-700 dark:text-gray-200">
          {String(error?.message || error)}
        </pre>
      )}
    </div>
  )
}

