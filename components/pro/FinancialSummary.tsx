'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Settings2, Save, Loader2, ChevronLeft, ChevronRight, Info } from 'lucide-react'

interface FinSettings {
  gpm_percent: number
  sodra_percent: number
  pvm_percent: number
  is_pvm_payer: boolean
  business_type: string
}

interface Receipt {
  amount: number | null
}

const DEFAULT_SETTINGS: FinSettings = {
  gpm_percent: 15,
  sodra_percent: 12.52,
  pvm_percent: 21,
  is_pvm_payer: false,
  business_type: 'individual',
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  const date = new Date(Number(y), Number(mo) - 1, 1)
  return date.toLocaleDateString('lt-LT', { month: 'long', year: 'numeric' })
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export default function FinancialSummary({ isPro }: { isPro: boolean }) {
  const [month, setMonth] = useState(currentMonth())
  const [settings, setSettings] = useState<FinSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [income, setIncome] = useState<number>(0)
  const [incomeNote, setIncomeNote] = useState('')
  const [expenses, setExpenses] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingIncome, setSavingIncome] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [settingsRes, incomeRes, receiptsRes] = await Promise.all([
      fetch('/api/finance/settings'),
      fetch(`/api/finance/income?month=${month}`),
      fetch(`/api/receipts?month=${month}`),
    ])

    if (settingsRes.ok) {
      const { settings: s } = await settingsRes.json()
      setSettings(s)
    }
    if (incomeRes.ok) {
      const { income: inc } = await incomeRes.json()
      setIncome(inc?.amount || 0)
      setIncomeNote(inc?.note || '')
    }
    if (receiptsRes.ok) {
      const { receipts } = await receiptsRes.json()
      const total = (receipts as Receipt[]).reduce((s, r) => s + (r.amount || 0), 0)
      setExpenses(total)
    }
    setLoading(false)
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveSettings() {
    setSaving(true)
    await fetch('/api/finance/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setShowSettings(false)
  }

  async function saveIncome() {
    setSavingIncome(true)
    await fetch('/api/finance/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, amount: income, note: incomeNote }),
    })
    setSavingIncome(false)
  }

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <TrendingUp size={28} className="text-blue-400" />
        </div>
        <h3 className="text-white font-bold text-lg">Finansų suvestinė — Pro funkcija</h3>
        <p className="text-gray-500 text-sm text-center max-w-xs">
          Automatinis mokesčių skaičiavimas ir finansų valdymas — nuo €29.99/mėn.
        </p>
        <a href="/pricing" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-2xl transition-colors">
          Atnaujinti į Pro
        </a>
      </div>
    )
  }

  // Calculations
  const net = income - expenses
  const gpmReserve = net > 0 ? net * (settings.gpm_percent / 100) : 0
  const sodraReserve = net > 0 ? net * (settings.sodra_percent / 100) : 0
  const pvmReserve = settings.is_pvm_payer && income > 0 ? income * (settings.pvm_percent / 100) : 0
  const totalReserve = gpmReserve + sodraReserve + pvmReserve
  const safeToSpend = net - totalReserve

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-400" />
          <h3 className="font-bold text-white">Finansų suvestinė</h3>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth(prevMonth(month))}
              className="p-2 rounded-xl bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-white min-w-[110px] text-center capitalize">
              {monthLabel(month)}
            </span>
            <button
              onClick={() => setMonth(nextMonth(month))}
              disabled={month >= currentMonth()}
              className="p-2 rounded-xl bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 transition-colors disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowSettings(v => !v)}
            className={`p-2 rounded-xl transition-colors ${showSettings ? 'bg-blue-600 text-white' : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400'}`}
            title="Mokesčių nustatymai"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Tax settings panel */}
      {showSettings && (
        <div className="bg-gray-900/60 rounded-2xl border border-gray-800/60 p-5 space-y-4">
          <h4 className="text-sm font-bold text-white">Mokesčių nustatymai</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Verslo tipas</label>
              <select
                value={settings.business_type}
                onChange={e => setSettings(p => ({ ...p, business_type: e.target.value }))}
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="individual">Individualus (IĮ / FU)</option>
                <option value="mb">MB (Mažoji bendrija)</option>
                <option value="uab">UAB</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">GPM % (pajamų mokestis)</label>
              <input
                type="number" min={0} max={50} step={0.1}
                value={settings.gpm_percent}
                onChange={e => setSettings(p => ({ ...p, gpm_percent: +e.target.value }))}
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sodra % (socialinis draudimas)</label>
              <input
                type="number" min={0} max={50} step={0.01}
                value={settings.sodra_percent}
                onChange={e => setSettings(p => ({ ...p, sodra_percent: +e.target.value }))}
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.is_pvm_payer}
                  onChange={e => setSettings(p => ({ ...p, is_pvm_payer: e.target.checked }))}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="text-sm text-white">PVM mokėtojas</span>
              </label>
              {settings.is_pvm_payer && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">PVM %</label>
                  <input
                    type="number" min={0} max={30}
                    value={settings.pvm_percent}
                    onChange={e => setSettings(p => ({ ...p, pvm_percent: +e.target.value }))}
                    className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-2xl transition-colors text-sm"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Išsaugoti nustatymus
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      ) : (
        <>
          {/* Income input */}
          <div className="bg-gray-900/40 rounded-2xl border border-gray-800/60 p-5 space-y-3">
            <h4 className="text-sm font-bold text-white">💰 Įplaukos (rankiniu būdu)</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                <input
                  type="number" min={0} step={0.01}
                  value={income || ''}
                  onChange={e => setIncome(+e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl pl-7 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <input
                value={incomeNote}
                onChange={e => setIncomeNote(e.target.value)}
                placeholder="Pastaba (nebūtina)"
                className="w-full sm:flex-1 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={saveIncome}
                disabled={savingIncome}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl transition-colors text-sm shrink-0"
              >
                {savingIncome ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Išsaugoti
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Income */}
            <div className="bg-green-500/8 border border-green-500/20 rounded-2xl p-4">
              <div className="text-xs text-green-400 font-medium mb-1">💰 Įplaukos</div>
              <div className="text-2xl font-bold text-white">€{income.toFixed(2)}</div>
            </div>

            {/* Expenses */}
            <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-4">
              <div className="text-xs text-red-400 font-medium mb-1">📦 Išlaidos (čekiai)</div>
              <div className="text-2xl font-bold text-white">€{expenses.toFixed(2)}</div>
            </div>

            {/* Net */}
            <div className={`border rounded-2xl p-4 ${net >= 0 ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-red-500/8 border-red-500/20'}`}>
              <div className={`text-xs font-medium mb-1 ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>📊 Grynasis</div>
              <div className="text-2xl font-bold text-white">{net >= 0 ? '' : '-'}€{Math.abs(net).toFixed(2)}</div>
            </div>

            {/* Safe to spend */}
            <div className={`border rounded-2xl p-4 ${safeToSpend >= 0 ? 'bg-blue-500/8 border-blue-500/20' : 'bg-orange-500/8 border-orange-500/20'}`}>
              <div className={`text-xs font-medium mb-1 ${safeToSpend >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>✅ Galima išleisti</div>
              <div className="text-2xl font-bold text-white">{safeToSpend >= 0 ? '' : '-'}€{Math.abs(safeToSpend).toFixed(2)}</div>
            </div>
          </div>

          {/* Reserve breakdown */}
          {net > 0 && (
            <div className="bg-gray-900/40 rounded-2xl border border-gray-800/60 p-5 space-y-3">
              <h4 className="text-sm font-bold text-white">🔒 Mokesčių rezervai</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">GPM ({settings.gpm_percent}%)</span>
                  <span className="text-white font-semibold">€{gpmReserve.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Sodra ({settings.sodra_percent}%)</span>
                  <span className="text-white font-semibold">€{sodraReserve.toFixed(2)}</span>
                </div>
                {settings.is_pvm_payer && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">PVM ({settings.pvm_percent}%)</span>
                    <span className="text-white font-semibold">€{pvmReserve.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-gray-800 pt-2 font-bold">
                  <span className="text-gray-300">Iš viso atidėti</span>
                  <span className="text-amber-400">€{totalReserve.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-900/30 rounded-xl p-3 border border-gray-800/40">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>Preliminarus skaičiavimas asmeniniam planavimui. Oficialiai naudokite VMI ir Sodros duomenis.</span>
          </div>
        </>
      )}
    </div>
  )
}
