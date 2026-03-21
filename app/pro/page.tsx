import { createClient } from '@/lib/server-supabase'
import { redirect } from 'next/navigation'
import RequestBoard from '@/components/pro/RequestBoard'
import { Briefcase, MapPin, Wrench } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ProDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Patikriname ar vartotojas turi 'master' rolę
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name, address_text')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'master') {
    // Jei ne meistras, grąžiname į pagrindinį
    redirect('/')
  }

  // Ištraukiame užklausas (demo tikslais dabar ištrauksime visas,
  // vėliau čia veiks PostGIS radius filtras)
  const { data: requests } = await supabase
    .from('service_requests')
    .select('*, client:profiles!client_id(display_name, username)')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 border border-gray-800 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase className="text-emerald-500" />
              Meistro Darbalaukis
            </h1>
            <p className="text-gray-400 mt-1 flex items-center gap-2">
              <MapPin size={16} /> 
              Tavo regionas: {profile.address_text || 'Nepriskirtas (matysi visus užsakymus)'}
            </p>
          </div>
          <div className="flex gap-4 bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
            <div className="text-center px-4 border-r border-gray-800">
              <div className="text-2xl font-bold text-emerald-400">
                {requests?.filter(r => r.status === 'open').length || 0}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Nauji</div>
            </div>
            <div className="text-center px-4">
              <div className="text-2xl font-bold text-blue-400">
                {requests?.filter(r => r.status === 'in_progress').length || 0}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Vykdomi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <RequestBoard initialRequests={requests || []} currentUserId={user.id} />
    </div>
  )
}
