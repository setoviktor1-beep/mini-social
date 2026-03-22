'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Trash2, Loader2, Receipt, Lock, AlertCircle, CheckCircle } from 'lucide-react'

interface ReceiptEntry {
  id: string
  vendor: string | null
  amount: number | null
  category: string | null
  receipt_date: string | null
  raw_text: string | null
  image_url: string | null
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  maistas: 'Maistas',
  transportas: 'Transportas',
  ryšiai: 'Ryšiai',
  įrankiai: 'Įrankiai',
  reklama: 'Reklama',
  apsauga: 'Apsauga',
  komunaliniai: 'Komunaliniai',
  kita: 'Kita',
}

const CATEGORY_COLORS: Record<string, string> = {
  maistas: 'bg-orange-500/15 text-orange-400',
  transportas: 'bg-blue-500/15 text-blue-400',
  ryšiai: 'bg-cyan-500/15 text-cyan-400',
  įrankiai: 'bg-yellow-500/15 text-yellow-400',
  reklama: 'bg-pink-500/15 text-pink-400',
  apsauga: 'bg-red-500/15 text-red-400',
  komunaliniai: 'bg-teal-500/15 text-teal-400',
  kita: 'bg-gray-500/15 text-gray-400',
}

export default function ReceiptScanner({ isEnterprise, month }: { isEnterprise: boolean; month: string }) {
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [flash, setFlash] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadReceipts = useCallback(async () => {
    const res = await fetch(`/api/receipts?month=${month}`)
    if (res.ok) {
      const { receipts: data } = await res.json()
      setReceipts(data)
    }
    setLoaded(true)
  }, [month])

  // Load on first render
  if (!loaded && isEnterprise) {
    loadReceipts()
  }

  async function handleFile(file: File) {
    if (!file) return
    setScanning(true)
    setFlash(null)

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const res = await fetch('/api/receipts/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      })

      setScanning(false)

      if (!res.ok) {
        const { error } = await res.json()
        setFlash({ type: 'err', msg: error === 'ENTERPRISE_REQUIRED' ? 'Reikalingas Enterprise planas.' : 'Klaida nuskaitant čekį.' })
        return
      }

      const { receipt } = await res.json()
      setReceipts(prev => [receipt, ...prev])
      setFlash({ type: 'ok', msg: `Čekis pridėtas: ${receipt.vendor || 'nežinomas pardavėjas'} €${receipt.amount ?? '?'}` })
      setTimeout(() => setFlash(null), 4000)
    }
    reader.readAsDataURL(file)
  }

  async function deleteReceipt(id: string) {
    const res = await fetch('/api/receipts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setReceipts(prev => prev.filter(r => r.id !== id))
  }

  if (!isEnterprise) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <Lock size={28} className="text-amber-400" />
        </div>
        <h3 className="text-white font-bold text-lg">Čekių nuskaitymas — Enterprise</h3>
        <p className="text-gray-500 text-sm text-center max-w-xs">
          AI čekių nuskaitymas prieinamas tik Enterprise planui (€89.99/mėn).
        </p>
        <a href="/pricing" className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-2xl transition-colors">
          Atnaujinti į Enterprise
        </a>
      </div>
    )
  }

  const totalAmount = receipts.reduce((s, r) => s + (r.amount || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            <Receipt size={18} className="text-amber-400" />
            Čekių nuskaitymas
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {month} · Iš viso: <span className="text-white font-semibold">€{totalAmount.toFixed(2)}</span> ({receipts.length} čekiai)
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-2xl transition-colors text-sm shrink-0"
        >
          {scanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {scanning ? 'Nuskaitoma...' : 'Nuskaityti čekį'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
      </div>

      {/* Flash */}
      {flash && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium ${
          flash.type === 'ok' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'
        }`}>
          {flash.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {flash.msg}
        </div>
      )}

      {/* List */}
      {receipts.length === 0 && !scanning && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 border border-dashed border-gray-800 rounded-2xl">
          <Receipt size={32} className="text-gray-700" />
          <p className="text-gray-500 text-sm">Čekių nėra. Nufotografuok pirmą čekį!</p>
        </div>
      )}

      <div className="space-y-3">
        {receipts.map(r => (
          <div key={r.id} className="bg-gray-900/40 rounded-2xl border border-gray-800/60 p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white text-sm truncate">{r.vendor || 'Nežinomas pardavėjas'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[r.category || 'kita'] || CATEGORY_COLORS.kita}`}>
                  {CATEGORY_LABELS[r.category || 'kita'] || 'Kita'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>{r.receipt_date || new Date(r.created_at).toLocaleDateString('lt-LT')}</span>
                {r.raw_text && <span className="truncate max-w-[200px]">{r.raw_text}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-lg font-bold text-white">
                {r.amount != null ? `€${r.amount.toFixed(2)}` : '—'}
              </span>
              <button
                onClick={() => deleteReceipt(r.id)}
                className="text-gray-600 hover:text-red-400 transition-colors p-1"
                title="Ištrinti"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
