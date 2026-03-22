'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Zap, Brain, Sparkles, Loader2 } from 'lucide-react'

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '14.99',
    icon: Zap,
    color: 'blue',
    description: 'Pradžiai — visi verslo įrankiai be AI',
    trial: false,
    features: [
      'Verslo profilis ir katalogas',
      'Užsakymų Kanban lenta',
      'Klientų žinutės',
      'Kalendorius',
      'Greiti atsakymai',
      'Darbo laikas ir spindulys',
      'Iki 50 užsakymų/mėn',
    ],
    limits: ['Nėra AI kainų skaičiavimo', 'Nėra AI chat'],
    cta: 'Pradėti',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '29.99',
    icon: Brain,
    color: 'emerald',
    description: 'AI pagalba su ribotais kiekiais',
    popular: true,
    trial: true,
    features: [
      'Viskas iš Basic',
      'AI kainų skaičiavimas (50/mėn)',
      'AI chat pagalbininkas (100/mėn)',
      'Iki 200 užsakymų/mėn',
      'Prioritetinis palaikymas',
    ],
    limits: ['AI limitai: 50 sąmatų / 100 žinučių'],
    cta: '14 dienų nemokamai',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '89.99',
    icon: Sparkles,
    color: 'purple',
    description: 'Pilna AI integracija be apribojimų',
    trial: true,
    features: [
      'Viskas iš Pro',
      'AI kainų skaičiavimas (500/mėn)',
      'AI chat (neribotai)',
      'Neriboti užsakymai',
      'Prioritetinis palaikymas 24/7',
      'Ankstyvoji prieiga prie naujų funkcijų',
    ],
    limits: [],
    cta: '14 dienų nemokamai',
  },
]

const COLOR_MAP: Record<string, { border: string; badge: string; btn: string; icon: string }> = {
  blue:    { border: 'border-blue-500/30',   badge: 'bg-blue-500/10 text-blue-400',    btn: 'bg-blue-600 hover:bg-blue-700',    icon: 'text-blue-400' },
  emerald: { border: 'border-emerald-500/50', badge: 'bg-emerald-500/10 text-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-700', icon: 'text-emerald-400' },
  purple:  { border: 'border-purple-500/30', badge: 'bg-purple-500/10 text-purple-400', btn: 'bg-purple-600 hover:bg-purple-700', icon: 'text-purple-400' },
}

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function subscribe(planId: string) {
    setLoading(planId)
    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (data.error === 'UNAUTHORIZED') {
        router.push('/auth/login')
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // ignore
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-black text-white">Verslo planai</h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Pasirink planą pagal savo poreikius. Bet kada gali pakeisti ar atšaukti.
        </p>
        <p className="text-gray-600 text-xs">Kainos su PVM (21%)</p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map(plan => {
          const Icon = plan.icon
          const c = COLOR_MAP[plan.color]
          const isLoading = loading === plan.id

          return (
            <div
              key={plan.id}
              className={`relative bg-gray-900 border rounded-3xl p-6 flex flex-col gap-5 transition-all ${c.border} ${plan.popular ? 'ring-2 ring-emerald-500/40' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-white text-xs font-black px-4 py-1 rounded-full">
                    POPULIARIAUSIAS
                  </span>
                </div>
              )}
              {plan.trial && !plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-purple-500 text-white text-xs font-black px-4 py-1 rounded-full">
                    14 DIENŲ NEMOKAMAI
                  </span>
                </div>
              )}

              <div>
                <div className={`w-10 h-10 rounded-2xl ${c.badge} flex items-center justify-center mb-3`}>
                  <Icon size={20} className={c.icon} />
                </div>
                <h2 className="text-xl font-black text-white">{plan.name}</h2>
                <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
              </div>

              <div>
                <span className="text-4xl font-black text-white">€{plan.price}</span>
                <span className="text-gray-500 text-sm ml-1">/mėn</span>
                {plan.trial && (
                  <p className="text-xs text-emerald-400 mt-1 font-medium">14 dienų nemokamas bandymas, tada €{plan.price}/mėn</p>
                )}
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
                {plan.limits.map(l => (
                  <li key={l} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5 shrink-0 w-[15px] text-center">·</span>
                    {l}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => subscribe(plan.id)}
                disabled={!!loading}
                className={`w-full flex items-center justify-center gap-2 ${c.btn} disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-colors`}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                {plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      {/* FAQ */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4 max-w-2xl mx-auto">
        <h3 className="font-bold text-white text-lg">D.U.K.</h3>
        {[
          { q: 'Ar galiu atšaukti bet kada?', a: 'Taip, atšaukus planą jis veikia iki periodo pabaigos.' },
          { q: 'Kas atsitinka viršijus AI limitus?', a: 'AI funkcijos sustabdomos iki kito mėnesio. Duomenys išsaugomi.' },
          { q: 'Ar reikia kortelės bandymui?', a: 'Ne — Pro ir Enterprise planus gali išbandyti 14 dienų be kortelės. Kortelė prašoma tik po bandomojo laikotarpio.' },
        ].map(({ q, a }) => (
          <div key={q}>
            <p className="font-bold text-gray-200 text-sm">{q}</p>
            <p className="text-gray-500 text-sm mt-0.5">{a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
