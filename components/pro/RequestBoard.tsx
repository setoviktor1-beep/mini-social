"use client";

import { useState } from 'react'
import { CheckCircle2, Clock, PlayCircle, MapPin, Hammer, MessageCircle, Plus, X, Loader2, Trash2, PenLine } from 'lucide-react'
import { createClient } from '@/lib/backend-client'
import Link from 'next/link'

type RequestBoardProps = {
  initialRequests: any[]
  currentUserId: string
}

interface NewOrderForm {
  clientName: string
  description: string
  estimatedPrice: string
  addressText: string
  status: string
}

const EMPTY_FORM: NewOrderForm = {
  clientName: '',
  description: '',
  estimatedPrice: '',
  addressText: '',
  status: 'open',
}

export default function RequestBoard({ initialRequests, currentUserId }: RequestBoardProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewOrderForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const supabase = createClient()

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('service_requests')
      .update({ status: newStatus, master_id: currentUserId })
      .eq('id', id)

    if (!error) {
      setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus, master_id: currentUserId } : r))
    }
  }

  const deleteRequest = async (id: string) => {
    const { error } = await supabase
      .from('service_requests')
      .delete()
      .eq('id', id)
      .eq('client_id', currentUserId) // only delete own (manual) entries

    if (!error) {
      setRequests(requests.filter(r => r.id !== id))
    }
  }

  const handleAdd = async () => {
    if (!form.description.trim()) {
      setFormError('Įveskite užsakymo aprašymą.')
      return
    }
    setSaving(true)
    setFormError('')

    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        client_id: currentUserId,
        master_id: currentUserId,
        description: form.description.trim(),
        estimated_price: form.estimatedPrice ? Number(form.estimatedPrice) : null,
        address_text: form.addressText.trim() || null,
        status: form.status,
        materials: { manual: true, client_name: form.clientName.trim() || 'Rankinis įvedimas' },
      })
      .select('*, client:profiles!client_id(display_name, username)')
      .single()

    setSaving(false)

    if (error) {
      setFormError('Klaida išsaugant. Bandykite dar kartą.')
      return
    }

    setRequests(prev => [data, ...prev])
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  const columns = [
    { id: 'open', title: 'Nauji Užsakymai', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-900/50' },
    { id: 'in_progress', title: 'Vykdomi', icon: PlayCircle, color: 'text-blue-400', bg: 'bg-blue-900/10 border-blue-900/30' },
    { id: 'completed', title: 'Baigti', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-900/10 border-emerald-900/30' },
  ]

  return (
    <>
      {/* Add button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setFormError('') }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-2xl transition-colors text-sm"
        >
          <Plus size={16} />
          Pridėti užsakymą
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map(col => (
          <div key={col.id} className={`rounded-3xl p-5 border border-gray-800 ${col.bg} min-h-[400px] md:min-h-[500px]`}>
            <div className="flex items-center gap-2 mb-6 border-b border-gray-800/50 pb-4">
              <col.icon className={col.color} size={20} />
              <h2 className="font-bold text-gray-200">{col.title}</h2>
              <span className="ml-auto bg-gray-800 text-xs px-2 py-1 rounded-full text-gray-400">
                {requests.filter(r => r.status === col.id).length}
              </span>
            </div>

            <div className="space-y-4">
              {requests.filter(r => r.status === col.id).map(req => {
                const isManual = req.materials?.manual === true
                const clientLabel = isManual
                  ? (req.materials?.client_name || 'Rankinis įvedimas')
                  : (req.client?.display_name || 'Klientas')

                return (
                  <div key={req.id} className="bg-gray-950 border border-gray-800 rounded-2xl p-4 shadow-sm hover:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isManual ? 'bg-amber-900/30 text-amber-400' : 'bg-blue-900/30 text-blue-400'
                        }`}>
                          {clientLabel.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
                            {clientLabel}
                            {isManual && (
                              <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                <PenLine size={9} />
                                rankinis
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin size={12} /> {req.address_text || 'Adresas nenurodytas'}
                          </div>
                        </div>
                      </div>
                      {isManual && (
                        <button
                          onClick={() => deleteRequest(req.id)}
                          className="p-1 text-gray-700 hover:text-red-400 transition-colors"
                          title="Ištrinti"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="text-sm text-gray-300 mb-4 line-clamp-3">
                      &quot;{req.description}&quot;
                    </div>

                    {req.estimated_price && (
                      <div className="bg-emerald-900/20 text-emerald-400 border border-emerald-900/30 rounded-lg p-2 text-xs font-semibold mb-4 flex items-center gap-2">
                        <Hammer size={14} />
                        {isManual ? 'Kaina' : 'AI Sąmata'}: ~{req.estimated_price}€
                      </div>
                    )}

                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-800/50">
                      {col.id === 'open' && (
                        <button
                          onClick={() => updateStatus(req.id, 'in_progress')}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition-colors"
                        >
                          Paimti darbą
                        </button>
                      )}
                      {col.id === 'in_progress' && (
                        <button
                          onClick={() => updateStatus(req.id, 'completed')}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition-colors"
                        >
                          Pažymėti kaip atliktą
                        </button>
                      )}
                      {!isManual && (
                        <Link
                          href="/messages"
                          className="p-2 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                          title="Parašyti klientui"
                        >
                          <MessageCircle size={16} />
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add order modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-emerald-400" />
                Pridėti užsakymą
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Kliento vardas</label>
                <input
                  value={form.clientName}
                  onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                  placeholder="Jonas Jonaitis"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Aprašymas *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Užsakymo aprašymas..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none placeholder-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Kaina (€)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.estimatedPrice}
                    onChange={e => setForm(p => ({ ...p, estimatedPrice: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Statusas</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="open">Naujas</option>
                    <option value="in_progress">Vykdomas</option>
                    <option value="completed">Baigtas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Adresas</label>
                <input
                  value={form.addressText}
                  onChange={e => setForm(p => ({ ...p, addressText: e.target.value }))}
                  placeholder="Gatvė, miestas"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-gray-600"
                />
              </div>

              {formError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 font-semibold transition-all text-sm"
              >
                Atšaukti
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-bold transition-all text-sm"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {saving ? 'Saugoma...' : 'Pridėti'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
