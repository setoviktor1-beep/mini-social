'use client'

import { useState } from 'react'
import { CheckCircle, X } from 'lucide-react'

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export default function SubscribedBanner({ plan }: { plan: string | null }) {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  const label = plan ? PLAN_LABELS[plan] || plan : null

  return (
    <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-4 text-emerald-300">
      <CheckCircle size={20} className="shrink-0 text-emerald-400" />
      <p className="flex-1 font-semibold text-sm sm:text-base">
        Sveikiname! {label ? <>Planas <strong>{label}</strong> sėkmingai aktyvuotas.</> : 'Prenumerata sėkmingai aktyvuota.'} Verslo darbalaukis yra paruoštas.
      </p>
      <button onClick={() => setVisible(false)} className="shrink-0 text-emerald-400 hover:text-emerald-200 p-1">
        <X size={18} />
      </button>
    </div>
  )
}
