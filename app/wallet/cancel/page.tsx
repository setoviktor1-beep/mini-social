import Link from 'next/link'

export default function WalletCancelPage() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 p-8 sm:p-12 text-center">
      <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">Payment canceled</p>
      <h1 className="mt-2 text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100">Top-up not completed</h1>
      <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-gray-400">
        No money was charged. You can retry anytime.
      </p>
      <div className="mt-6">
        <Link
          href="/settings"
          className="inline-flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-6 py-2.5 rounded-full font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
        >
          Back to Settings
        </Link>
      </div>
    </div>
  )
}

