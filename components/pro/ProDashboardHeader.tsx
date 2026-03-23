'use client'

import { useState } from 'react'
import { Briefcase, MapPin, Pencil, Check, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const CATEGORIES = [
  'Fotografas', 'Valymas', 'Santechnikas', 'Elektriku paslaugos', 'Statybos darbai',
  'Baldų surinkimas', 'Kraustymosi paslaugos', 'Automobilių remontas', 'Grožio paslaugos',
  'Masažas', 'Asmeninis treneris', 'Maisto gaminimas', 'Renginių organizavimas',
  'IT paslaugos', 'Buhalterinė apskaita', 'Teisės paslaugos', 'Kita',
]

interface Props {
  userId: string
  businessName: string | null
  displayName: string | null
  businessCategory: string | null
  addressText: string | null
  openCount: number
  inProgressCount: number
}

export default function ProDashboardHeader({
  userId,
  businessName,
  displayName,
  businessCategory,
  addressText,
  openCount,
  inProgressCount,
}: Props) {
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(businessName || displayName || '')
  const [category, setCategory] = useState(businessCategory || '')

  // Saved display values (updated after save)
  const [savedName, setSavedName] = useState(businessName || displayName || '')
  const [savedCategory, setSavedCategory] = useState(businessCategory || '')

  async function save() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({
        business_name: name.trim() || null,
        business_category: category || null,
      })
      .eq('id', userId)
    setSavedName(name.trim())
    setSavedCategory(category)
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setName(savedName)
    setCategory(savedCategory)
    setEditing(false)
  }

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 border border-gray-800 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase className="text-emerald-500 shrink-0" />
              Verslo Darbalaukis
            </h1>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg hover:bg-gray-700/60 text-gray-500 hover:text-gray-300 transition-colors"
                title="Redaguoti"
              >
                <Pencil size={15} />
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-3 space-y-2">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Verslo pavadinimas"
                className="w-full bg-gray-800/80 border border-gray-700 focus:border-emerald-500/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-gray-800/80 border border-gray-700 focus:border-emerald-500/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="">— Pasirinkite kategoriją —</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c.toLowerCase()}>{c}</option>
                ))}
              </select>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Išsaugoti
                </button>
                <button
                  onClick={cancel}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  <X size={14} />
                  Atšaukti
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-400 mt-2 flex items-center gap-2 font-medium flex-wrap">
                <span>{savedName || '—'}</span>
                <span className="text-emerald-500/50">•</span>
                <span className="text-gray-500">{savedCategory || 'Kategorija nenustatyta'}</span>
              </p>
              <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
                <MapPin size={14} className="shrink-0" />
                Regionas: {addressText || 'Nepriskirtas'}
              </p>
            </>
          )}
        </div>

        <div className="flex gap-4 bg-gray-950/50 p-4 rounded-2xl border border-gray-800 shrink-0">
          <div className="text-center px-4 border-r border-gray-800">
            <div className="text-2xl font-bold text-emerald-400">{openCount}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Nauji</div>
          </div>
          <div className="text-center px-4">
            <div className="text-2xl font-bold text-blue-400">{inProgressCount}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Vykdomi</div>
          </div>
        </div>
      </div>
    </div>
  )
}
