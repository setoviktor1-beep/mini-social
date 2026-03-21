"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Request {
  id: string;
  description: string;
  status: string;
  created_at: string;
  client?: any;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  assigned: 'bg-yellow-500',
};

const MONTH_LT = [
  'Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis',
  'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'
];

const DAY_LT = ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'];

export default function ProCalendar({ proId }: { proId: string }) {
  const supabase = createClient();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('service_requests')
        .select('id, description, status, created_at, client:profiles!client_id(display_name, username)')
        .or(`master_id.eq.${proId},client_id.eq.${proId}`)
        .order('created_at', { ascending: false });
      setRequests(data || []);
      setLoading(false);
    }
    load();
  }, [proId]);

  // Group requests by date string YYYY-MM-DD
  const byDate = useMemo(() => {
    const map: Record<string, Request[]> = {};
    requests.forEach(r => {
      const d = r.created_at.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [requests]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  // Week starts Monday: shift Sunday(0) to 6, Mon(1) to 0, etc.
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const selectedRequests = selectedDate ? (byDate[selectedDate] || []) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Calendar */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-bold text-white text-lg">
              {MONTH_LT[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_LT.map(d => (
              <div key={d} className="text-center text-xs text-gray-600 font-bold py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const key = dateKey(day);
              const dayRequests = byDate[key] || [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 transition-colors text-sm font-medium
                    ${isSelected ? 'bg-emerald-600 text-white' : isToday ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-gray-800 text-gray-300'}
                  `}
                >
                  {day}
                  {dayRequests.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                      {dayRequests.slice(0, 3).map(r => (
                        <span
                          key={r.id}
                          className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-500'}`}
                        />
                      ))}
                      {dayRequests.length > 3 && (
                        <span className="text-[8px] text-gray-500">+{dayRequests.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-800/50">
            {Object.entries({ open: 'Nauji', in_progress: 'Vykdomi', completed: 'Baigti' }).map(([status, label]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Selected day details */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5">
          {selectedDate ? (
            <>
              <h3 className="font-bold text-white mb-4 text-sm">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('lt-LT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              {selectedRequests.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">Šią dieną užklausų nėra</p>
              ) : (
                <div className="space-y-3">
                  {selectedRequests.map(r => (
                    <div key={r.id} className="bg-gray-950 border border-gray-800 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[r.status] || 'bg-gray-500'}`} />
                        <span className="text-xs text-gray-400 font-medium">
                          {r.client && !Array.isArray(r.client) ? (r.client.display_name || r.client.username) : 'Klientas'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">{r.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 text-gray-600">
              <p className="text-sm text-center">Pasirink dieną kalendoriuje, kad matytum užklausas</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Iš viso', count: requests.length, color: 'text-gray-300' },
          { label: 'Nauji', count: requests.filter(r => r.status === 'open').length, color: 'text-gray-400' },
          { label: 'Vykdomi', count: requests.filter(r => r.status === 'in_progress').length, color: 'text-blue-400' },
          { label: 'Baigti', count: requests.filter(r => r.status === 'completed').length, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
