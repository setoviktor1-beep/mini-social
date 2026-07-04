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

const COLOR_MAP: Record<string, { border: string; badge: string; btn: string; icon: string; badgeBg: string }> = {
  blue:    { border: 'border-blue-200',    badge: 'bg-blue-50 text-blue-600',       btn: 'bg-blue-600 hover:bg-blue-700',       icon: 'text-blue-500', badgeBg: 'bg-blue-500' },
  emerald: { border: 'border-emerald-300', badge: 'bg-emerald-50 text-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700', icon: 'text-emerald-500', badgeBg: 'bg-emerald-500' },
  purple:  { border: 'border-purple-200',  badge: 'bg-purple-50 text-purple-600',   btn: 'bg-purple-600 hover:bg-purple-700',   icon: 'text-purple-500', badgeBg: 'bg-purple-500' },
}

interface Props {
  currentPlan: string | null
  currentStatus: string | null
  checkoutStatus: string | null
}

export default function PricingClient({ currentPlan, currentStatus, checkoutStatus }: Props) {
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
      if (data.error === 'ALREADY_SUBSCRIBED') {
        router.push('/pro')
        return
      }
      if (data.error === 'CHECKOUT_IN_PROGRESS' && data.url) {
        window.location.href = data.url
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

  const isActivePlan = (planId: string) =>
    currentPlan === planId && (currentStatus === 'active' || currentStatus === 'trialing')

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900">Verslo planai</h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Pasirink planą pagal savo poreikius. Bet kada gali pakeisti ar atšaukti.
        </p>
        <p className="text-slate-400 text-xs">Kainos su PVM (21%)</p>
      </div>

      {checkoutStatus === 'success' && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Checkout baigtas. Laukiama galutinio Stripe prenumeratos patvirtinimo, po kurio planas taps aktyvus.
        </div>
      )}

      {currentPlan && (
        <div className="text-center">
          <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-4 py-1.5 text-sm font-semibold">
            <Check size={14} />
            Aktyvus planas: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
            {currentStatus === 'trialing' && ' (bandomasis)'}
          </span>
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map(plan => {
          const Icon = plan.icon
          const c = COLOR_MAP[plan.color]
          const isLoading = loading === plan.id
          const active = isActivePlan(plan.id)

          return (
            <div
              key={plan.id}
              className={`relative bg-white border rounded-3xl p-6 flex flex-col gap-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${active ? 'ring-2 ring-emerald-400 border-emerald-300' : c.border} ${plan.popular && !active ? 'ring-2 ring-emerald-400/50 shadow-md' : 'shadow-sm'}`}
            >
              {active && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-white text-xs font-black px-4 py-1 rounded-full shadow-sm">
                    ✓ AKTYVUS PLANAS
                  </span>
                </div>
              )}
              {!active && plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-500 text-white text-xs font-black px-4 py-1 rounded-full shadow-sm">
                    POPULIARIAUSIAS
                  </span>
                </div>
              )}
              {!active && plan.trial && !plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-purple-500 text-white text-xs font-black px-4 py-1 rounded-full shadow-sm">
                    14 DIENŲ NEMOKAMAI
                  </span>
                </div>
              )}

              <div>
                <div className={`w-10 h-10 rounded-2xl ${c.badge} flex items-center justify-center mb-3`}>
                  <Icon size={20} className={c.icon} />
                </div>
                <h2 className="text-xl font-black text-slate-900">{plan.name}</h2>
                <p className="text-slate-500 text-sm mt-1">{plan.description}</p>
              </div>

              <div>
                <div className="flex items-baseline">
                  <span className="text-lg font-semibold text-slate-500">€</span>
                  <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                  <span className="text-slate-400 text-sm ml-1">/mėn</span>
                </div>
                {plan.trial && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">14 dienų nemokamas bandymas, tada €{plan.price}/mėn</p>
                )}
              </div>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
                {plan.limits.map(l => (
                  <li key={l} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <span className="mt-0.5 shrink-0 w-4 text-center text-slate-300">·</span>
                    {l}
                  </li>
                ))}
              </ul>

              {active ? (
                <div className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold py-3 rounded-2xl">
                  <Check size={16} />
                  Aktyvus planas
                </div>
              ) : (
                <button
                  onClick={() => subscribe(plan.id)}
                  disabled={!!loading}
                  className={`w-full flex items-center justify-center gap-2 ${c.btn} disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all hover:shadow-lg hover:-translate-y-0.5`}
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {plan.cta}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* FAQ */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 max-w-2xl mx-auto shadow-sm">
        <h3 className="font-bold text-slate-900 text-lg">D.U.K.</h3>
        {[
          { q: 'Ar galiu atšaukti bet kada?', a: 'Taip, atšaukus planą jis veikia iki periodo pabaigos.' },
          { q: 'Kas atsitinka viršijus AI limitus?', a: 'AI funkcijos sustabdomos iki kito mėnesio. Duomenys išsaugomi.' },
          { q: 'Ar reikia kortelės bandymui?', a: 'Ne — Pro ir Enterprise planus gali išbandyti 14 dienų be kortelės. Kortelė prašoma tik po bandomojo laikotarpio.' },
        ].map(({ q, a }) => (
          <div key={q} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0">
            <p className="font-semibold text-slate-800 text-sm">{q}</p>
            <p className="text-slate-500 text-sm mt-0.5">{a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
