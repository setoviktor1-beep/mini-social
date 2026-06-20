'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Loader2, Wallet } from 'lucide-react'

export default function WalletCard() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [topupLoading, setTopupLoading] = useState<number | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .maybeSingle()

      setBalance(Number(profile?.balance || 0))
      setLoading(false)
    }

    void load()
  }, [supabase])

  const startTopup = async (amount: 5 | 10 | 20) => {
    setTopupLoading(amount)
    setError('')
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const json = await res.json()
      if (!res.ok || !json?.url) {
        if (json?.error === 'CHECKOUT_IN_PROGRESS') {
          setError('Jau turite aktyvų apmokėjimo langą. Palaukite arba grįžkite į jau atidarytą Stripe langą.')
        } else {
          setError(json?.error || 'Failed to start checkout')
        }
        return
      }
      window.location.href = json.url
    } catch {
      setError('Failed to start checkout')
    } finally {
      setTopupLoading(null)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden text-gray-900 dark:text-gray-100">
      <div className="px-6 py-5 border-b border-gray-50 dark:border-gray-800">
        <h2 className="font-bold text-xl flex items-center gap-2">
          <Wallet size={20} className="text-blue-600 dark:text-blue-400" />
          Mano Piniginė
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Valdykite savo kreditus ir paslaugų planus</p>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wider">Einamasis likutis</p>
          <p className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-0.5">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
                <Loader2 size={14} className="animate-spin" />
                Kraunama...
              </span>
            ) : (
              `€${balance.toFixed(2)}`
            )}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[5, 10, 20].map((amount) => (
            <button
              key={amount}
              onClick={() => startTopup(amount as 5 | 10 | 20)}
              disabled={topupLoading !== null}
              className="px-4 py-2.5 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-60 min-h-[44px]"
            >
              {topupLoading === amount ? 'Nukreipiama...' : `Pridėti €${amount}`}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
