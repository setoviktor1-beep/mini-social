'use client'
import { useState } from 'react'
import { BadgeCheck, CreditCard, Loader2, ExternalLink } from 'lucide-react'

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const PLAN_PRICES: Record<string, string> = {
  basic: '€14.99',
  pro: '€29.99',
  enterprise: '€89.99',
}

const PLAN_COLORS: Record<string, { badge: string; border: string; icon: string }> = {
  basic:      { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',    border: 'border-blue-500/20',    icon: 'text-blue-400' },
  pro:        { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  enterprise: { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',  border: 'border-purple-500/20',  icon: 'text-purple-400' },
}

interface Props {
  sub: {
    plan: string
    status: string
    current_period_end?: string | null
    cancel_at_period_end?: boolean | null
  } | null
}

export default function SubscriptionCard({ sub }: Props) {
  const [loading, setLoading] = useState(false)

  const openPortal = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  if (!sub) return null

  const plan = sub.plan || 'basic'
  const c = PLAN_COLORS[plan] || PLAN_COLORS.basic
  const label = PLAN_LABELS[plan] || plan
  const price = PLAN_PRICES[plan] || ''
  const isTrialing = sub.status === 'trialing'
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('lt-LT')
    : null

  return (
    <div className={`bg-gray-900 border ${c.border} rounded-3xl p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${c.badge} border`}>
            <BadgeCheck size={24} className={c.icon} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-black px-3 py-0.5 rounded-full border ${c.badge}`}>
                {label}
              </span>
              {isTrialing && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Bandomasis
                </span>
              )}
              {sub.cancel_at_period_end && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
                  Atšaukiamas
                </span>
              )}
            </div>
            <p className="text-white font-bold text-lg mt-1">
              {price}<span className="text-gray-500 text-sm font-normal">/mėn su PVM</span>
            </p>
            {periodEnd && (
              <p className="text-gray-500 text-xs mt-0.5">
                {sub.cancel_at_period_end
                  ? `Galioja iki: ${periodEnd}`
                  : isTrialing
                  ? `Bandomasis baigiasi: ${periodEnd}`
                  : `Kitas mokėjimas: ${periodEnd}`}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={openPortal}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold transition-colors disabled:opacity-50 text-sm border border-gray-700"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
          Valdyti prenumeratą
          <ExternalLink size={14} className="text-gray-400" />
        </button>
      </div>
    </div>
  )
}
