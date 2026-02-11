import Link from 'next/link'

export default function WalletSuccessPage() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 p-8 sm:p-12 text-center">
      <p className="text-sm font-bold text-green-600 dark:text-green-400">Payment successful</p>
      <h1 className="mt-2 text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100">Wallet topped up</h1>
      <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-gray-400">
        Your balance will update shortly. You can now continue using AI tools.
      </p>
      <div className="mt-6">
        <Link
          href="/settings"
          className="inline-flex items-center justify-center bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          Back to Settings
        </Link>
      </div>
    </div>
  )
}

