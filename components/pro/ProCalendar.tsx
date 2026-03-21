"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Loader2, Plus, Pencil, Trash2, X, Check, Clock } from 'lucide-react';

interface ServiceRequest {
  id: string;
  description: string;
  status: string;
  created_at: string;
  client?: any;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  time_start: string | null;
  time_end: string | null;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  assigned: 'bg-yellow-500',
};

const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  blue:   { dot: 'bg-blue-500',   bg: 'bg-blue-900/30',   text: 'text-blue-300' },
  green:  { dot: 'bg-emerald-500', bg: 'bg-emerald-900/30', text: 'text-emerald-300' },
  red:    { dot: 'bg-red-500',    bg: 'bg-red-900/30',    text: 'text-red-300' },
  yellow: { dot: 'bg-yellow-400', bg: 'bg-yellow-900/30', text: 'text-yellow-300' },
  purple: { dot: 'bg-purple-500', bg: 'bg-purple-900/30', text: 'text-purple-300' },
};

const MONTH_LT = ['Sausis','Vasaris','Kovas','Balandis','Gegužė','Birželis','Liepa','Rugpjūtis','Rugsėjis','Spalis','Lapkritis','Gruodis'];
const DAY_LT = ['Pr','An','Tr','Kt','Pn','Št','Sk'];

const EMPTY_FORM = { title: '', description: '', time_start: '', time_end: '', color: 'blue' };

export default function ProCalendar({ proId }: { proId: string }) {
  const supabase = createClient();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: reqs }, { data: evts }] = await Promise.all([
        supabase
          .from('service_requests')
          .select('id, description, status, created_at, client:profiles!client_id(display_name, username)')
          .or(`master_id.eq.${proId},client_id.eq.${proId}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('calendar_events')
          .select('*')
          .eq('pro_id', proId)
          .order('event_date', { ascending: true }),
      ]);
      setRequests(reqs || []);
      setEvents(evts || []);
      setLoading(false);
    }
    load();
  }, [proId]);

  // Group requests by date
  const requestsByDate = useMemo(() => {
    const map: Record<string, ServiceRequest[]> = {};
    requests.forEach(r => {
      const d = r.created_at.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [requests]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      if (!map[e.event_date]) map[e.event_date] = [];
      map[e.event_date].push(e);
    });
    return map;
  }, [events]);

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
    setSelectedDate(null); closeForm();
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
    setSelectedDate(null); closeForm();
  }

  function openNewEvent(date: string) {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setSelectedDate(date);
    setShowForm(true);
  }

  function openEditEvent(e: CalendarEvent) {
    setEditingEvent(e);
    setForm({ title: e.title, description: e.description || '', time_start: e.time_start || '', time_end: e.time_end || '', color: e.color });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingEvent(null);
    setForm(EMPTY_FORM);
  }

  async function saveEvent() {
    if (!form.title.trim() || !selectedDate) return;
    setSaving(true);

    const payload = {
      pro_id: proId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: selectedDate,
      time_start: form.time_start || null,
      time_end: form.time_end || null,
      color: form.color,
    };

    if (editingEvent) {
      const { data } = await supabase.from('calendar_events').update(payload).eq('id', editingEvent.id).select().single();
      if (data) setEvents(prev => prev.map(e => e.id === editingEvent.id ? data : e));
    } else {
      const { data } = await supabase.from('calendar_events').insert(payload).select().single();
      if (data) setEvents(prev => [...prev, data]);
    }

    setSaving(false);
    closeForm();
  }

  async function deleteEvent(id: string) {
    await supabase.from('calendar_events').delete().eq('id', id);
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  const selectedRequests = selectedDate ? (requestsByDate[selectedDate] || []) : [];
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* Calendar */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"><ChevronLeft size={18} /></button>
            <h2 className="font-bold text-white text-lg">{MONTH_LT[month]} {year}</h2>
            <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"><ChevronRight size={18} /></button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DAY_LT.map(d => <div key={d} className="text-center text-xs text-gray-600 font-bold py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const key = dateKey(day);
              const dayReqs = requestsByDate[key] || [];
              const dayEvts = eventsByDate[key] || [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;

              return (
                <button
                  key={key}
                  onClick={() => { setSelectedDate(isSelected ? null : key); closeForm(); }}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 transition-colors text-sm font-medium
                    ${isSelected ? 'bg-emerald-600 text-white' : isToday ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-gray-800 text-gray-300'}`}
                >
                  {day}
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center px-0.5">
                    {dayEvts.slice(0, 2).map(e => (
                      <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${EVENT_COLORS[e.color]?.dot || 'bg-blue-500'}`} />
                    ))}
                    {dayReqs.slice(0, 2).map(r => (
                      <span key={r.id} className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-500'}`} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-800/50">
            <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-500" /> Įvykis</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-500" /> Naujas</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-500" /> Vykdomas</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Baigtas</div>
          </div>
        </div>

        {/* Right panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 flex flex-col gap-4">
          {selectedDate ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('lt-LT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                {!showForm && (
                  <button
                    onClick={() => openNewEvent(selectedDate)}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Plus size={13} /> Įvykis
                  </button>
                )}
              </div>

              {/* Add / Edit form */}
              {showForm && (
                <div className="bg-gray-800/60 rounded-2xl p-4 space-y-3 border border-emerald-800/40">
                  <p className="text-xs font-bold text-emerald-400">{editingEvent ? 'Redaguoti įvykį' : 'Naujas įvykis'}</p>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Pavadinimas *"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600"
                  />
                  <input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Aprašymas (neprivaloma)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Pradžia</label>
                      <input type="time" value={form.time_start} onChange={e => setForm(f => ({ ...f, time_start: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Pabaiga</label>
                      <input type="time" value={form.time_end} onChange={e => setForm(f => ({ ...f, time_end: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600" />
                    </div>
                  </div>
                  {/* Color picker */}
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-500">Spalva:</span>
                    {Object.entries(EVENT_COLORS).map(([c, v]) => (
                      <button
                        key={c}
                        onClick={() => setForm(f => ({ ...f, color: c }))}
                        className={`w-5 h-5 rounded-full ${v.dot} transition-transform ${form.color === c ? 'scale-125 ring-2 ring-white/50' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEvent} disabled={saving || !form.title.trim()}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-1.5 px-4 rounded-xl text-xs transition-colors">
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Išsaugoti
                    </button>
                    <button onClick={closeForm}
                      className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-1.5 px-3 rounded-xl text-xs transition-colors">
                      <X size={12} /> Atšaukti
                    </button>
                  </div>
                </div>
              )}

              {/* Events list */}
              {selectedEvents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 uppercase tracking-wider font-bold">Įvykiai</p>
                  {selectedEvents.map(e => {
                    const c = EVENT_COLORS[e.color] || EVENT_COLORS.blue;
                    return (
                      <div key={e.id} className={`${c.bg} border border-gray-700/50 rounded-xl p-3 flex items-start gap-2`}>
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${c.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${c.text}`}>{e.title}</p>
                          {e.description && <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>}
                          {(e.time_start || e.time_end) && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {e.time_start}{e.time_end ? ` – ${e.time_end}` : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEditEvent(e)} className="p-1 rounded-lg hover:bg-gray-700 text-gray-500 hover:text-gray-200 transition-colors"><Pencil size={12} /></button>
                          <button onClick={() => deleteEvent(e.id)} className="p-1 rounded-lg hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Requests list */}
              {selectedRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 uppercase tracking-wider font-bold">Užklausos</p>
                  {selectedRequests.map(r => (
                    <div key={r.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
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

              {selectedEvents.length === 0 && selectedRequests.length === 0 && !showForm && (
                <p className="text-sm text-gray-600 text-center py-4">Šią dieną nieko nėra.<br/>Paspausk &quot;Įvykis&quot; kad pridėtum.</p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 text-gray-600">
              <p className="text-sm text-center">Pasirink dieną kalendoriuje</p>
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
