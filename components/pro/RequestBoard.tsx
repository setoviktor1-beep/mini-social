"use client";

import { useState } from 'react'
import { CheckCircle2, Clock, PlayCircle, MapPin, Hammer, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

type RequestBoardProps = {
  initialRequests: any[]
  currentUserId: string
}

export default function RequestBoard({ initialRequests, currentUserId }: RequestBoardProps) {
  const [requests, setRequests] = useState(initialRequests)
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

  const columns = [
    { id: 'open', title: 'Nauji Užsakymai', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-900/50' },
    { id: 'in_progress', title: 'Vykdomi', icon: PlayCircle, color: 'text-blue-400', bg: 'bg-blue-900/10 border-blue-900/30' },
    { id: 'completed', title: 'Baigti', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-900/10 border-emerald-900/30' }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {columns.map(col => (
        <div key={col.id} className={`rounded-3xl p-5 border border-gray-800 ${col.bg} min-h-[500px]`}>
          <div className="flex items-center gap-2 mb-6 border-b border-gray-800/50 pb-4">
            <col.icon className={col.color} size={20} />
            <h2 className="font-bold text-gray-200">{col.title}</h2>
            <span className="ml-auto bg-gray-800 text-xs px-2 py-1 rounded-full text-gray-400">
              {requests.filter(r => r.status === col.id).length}
            </span>
          </div>

          <div className="space-y-4">
            {requests.filter(r => r.status === col.id).map(req => (
              <div key={req.id} className="bg-gray-950 border border-gray-800 rounded-2xl p-4 shadow-sm hover:border-gray-700 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                      {req.client?.display_name?.charAt(0) || 'K'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-200">{req.client?.display_name || 'Klientas'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin size={12} /> {req.address_text || 'Adresas nenurodytas'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-300 mb-4 line-clamp-3">
                  &quot;{req.description}&quot;
                </div>

                {req.estimated_price && (
                  <div className="bg-emerald-900/20 text-emerald-400 border border-emerald-900/30 rounded-lg p-2 text-xs font-semibold mb-4 flex items-center gap-2">
                    <Hammer size={14} />
                    AI Sąmata: ~{req.estimated_price}€
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
                  <Link 
                    href={`/messages`}
                    className="p-2 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    title="Parašyti klientui"
                  >
                    <MessageCircle size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
