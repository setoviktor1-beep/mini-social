import { createClient } from '@/lib/backend-server'
import { redirect } from 'next/navigation'
import { ClipboardList, Clock3, CheckCircle2, Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { label: string; className: string; icon: typeof Clock3 }> = {
  open: {
    label: 'Atvira',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Clock3,
  },
  assigned: {
    label: 'Vykdoma',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    icon: Loader2,
  },
  in_progress: {
    label: 'Vykdoma',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    icon: Loader2,
  },
  completed: {
    label: 'Baigta',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
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
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Mano užsakymai</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Čia matysite visas savo paslaugų užklausas ir jų eigą.
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
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${meta.className}`}
                    >
                      <StatusIcon size={14} />
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(request.created_at)}</span>
                  </div>

                  <p className="text-sm leading-6 text-slate-800">{request.description}</p>

                  <div className="flex flex-col gap-2 text-sm text-slate-500">
                    <span>Adresas: {request.address_text || 'Nenurodytas'}</span>
                    <span>Paslaugos teikėjas: {masterName || 'Dar nepriskirtas'}</span>
                    {request.estimated_price != null && (
                      <span>Numatoma kaina: €{request.estimated_price}</span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <ClipboardList size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Užsakymų dar nėra</h2>
          <p className="mt-2 text-sm text-slate-500">
            Kai pateiksite paslaugos užklausą, ji atsiras šiame puslapyje.
          </p>
        </div>
      )}
    </div>
  )
}
