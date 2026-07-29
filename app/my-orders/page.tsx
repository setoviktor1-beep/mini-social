import { createClient } from '@/lib/backend-server'
import { redirect } from 'next/navigation'
import { ClipboardList, Clock3, CheckCircle2, Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { label: string; className: string; icon: typeof Clock3 }> = {
  open: {
    label: 'Open',
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    icon: Clock3,
  },
  assigned: {
    label: 'In Progress',
    className: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    icon: Loader2,
  },
  in_progress: {
    label: 'In Progress',
    className: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    icon: Loader2,
  },
  completed: {
    label: 'Completed',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    icon: CheckCircle2,
  },
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('lt-LT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default async function MyOrdersPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: requests, error } = await supabase
    .from('service_requests')
    .select('id, description, address_text, status, estimated_price, created_at, master:profiles!master_id(display_name, business_name, username)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <div className="rounded-3xl border border-gray-800 bg-gradient-to-br from-[#111827] to-[#0a0a0f] p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-400">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Mano Užsakymai</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Čia matysi visas savo paslaugų užklausas ir jų eigą.
            </p>
          </div>
        </div>
      </div>

      {requests?.length ? (
        <div className="grid gap-4">
          {requests.map((request) => {
            const meta = STATUS_META[request.status] ?? STATUS_META.open
            const StatusIcon = meta.icon
            const assignedMaster = Array.isArray(request.master) ? request.master[0] : request.master
            const masterName =
              assignedMaster?.business_name ||
              assignedMaster?.display_name ||
              assignedMaster?.username ||
              null

            return (
              <article
                key={request.id}
                className="rounded-3xl border border-gray-800 bg-[#0f1117] p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${meta.className}`}
                      >
                        <StatusIcon size={14} />
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(request.created_at)}</span>
                    </div>

                    <p className="text-sm leading-6 text-gray-200">{request.description}</p>

                    <div className="flex flex-col gap-2 text-sm text-gray-400">
                      <span>Adresas: {request.address_text || 'Nenurodytas'}</span>
                      <span>Paslaugos teikėjas: {masterName || 'Dar nepriskirtas'}</span>
                      {request.estimated_price != null && (
                        <span>Numatoma kaina: €{request.estimated_price}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 sm:text-right">
                    ID: {request.id.slice(0, 8)}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-800 bg-[#0f1117] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800/70 text-gray-400">
            <ClipboardList size={24} />
          </div>
          <h2 className="text-lg font-bold text-white">Užsakymų dar nėra</h2>
          <p className="mt-2 text-sm text-gray-400">
            Kai pateiksi paslaugos užklausą, ji atsiras šiame puslapyje.
          </p>
        </div>
      )}
    </div>
  )
}
