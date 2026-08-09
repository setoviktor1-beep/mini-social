'use client'
import { useMemo, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { createClient } from '@/lib/backend-client'

export default function ReportUserButton({ profileId, currentUserId }: { profileId: string; currentUserId?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!currentUserId || currentUserId === profileId) return null

  const submit = async () => {
    if (!reason.trim() || loading) return
    setLoading(true)
    const { error } = await supabase.from('reports').insert({
      reporter_id: currentUserId,
      target_type: 'user',
      target_id: profileId,
      reason: reason.trim(),
    })
    setLoading(false)
    if (!error) {
      setSent(true)
      setTimeout(() => {
        setOpen(false)
        setReason('')
        setSent(false)
      }, 1500)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pranešti apie vartotoją"
        title="Pranešti apie vartotoją"
        className="flex items-center gap-2 border-2 border-slate-200 text-slate-700 px-6 sm:px-8 py-2.5 rounded-full font-bold hover:border-amber-200 hover:text-amber-600 hover:bg-amber-50 transition-all min-h-[44px] text-sm"
      >
        <AlertCircle size={16} />
        Pranešti
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-900">Pranešti apie vartotoją</h3>
              <button onClick={() => setOpen(false)} aria-label="Uždaryti" className="text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors">
                <X size={20} />
              </button>
            </div>
            {sent ? (
              <p className="text-emerald-600 font-bold text-center py-4">Pranešimas išsiųstas. Ačiū!</p>
            ) : (
              <>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Kodėl pranešate apie šį vartotoją?"
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-500/10 resize-none min-h-[100px] bg-slate-50 text-slate-800"
                  maxLength={500}
                />
                <button
                  onClick={submit}
                  disabled={!reason.trim() || loading}
                  className="mt-3 w-full bg-amber-500 text-white py-2.5 rounded-full font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  {loading ? 'Siunčiama...' : 'Siųsti pranešimą'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
