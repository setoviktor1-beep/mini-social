import Link from 'next/link'
import { WifiOff } from 'lucide-react'

export const metadata = {
  title: 'Offline',
}

export default function OfflinePage() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 p-8 sm:p-12 text-center">
      <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
        <WifiOff className="text-gray-400 dark:text-gray-500" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100">You&apos;re offline</h1>
      <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-gray-400">
        Check your internet connection and try again.
      </p>
      <div className="mt-6 flex justify-center gap-3 flex-wrap">
        <Link
          href="/"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-blue-700 transition-colors min-h-[44px] inline-flex items-center"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}

