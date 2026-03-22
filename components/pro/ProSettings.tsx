"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Clock, MapPin, Loader2, Check, Lock } from 'lucide-react';

const DAYS = [
  { key: 'mon', label: 'Pirmadienis' },
  { key: 'tue', label: 'Antradienis' },
  { key: 'wed', label: 'Trečiadienis' },
  { key: 'thu', label: 'Ketvirtadienis' },
  { key: 'fri', label: 'Penktadienis' },
  { key: 'sat', label: 'Šeštadienis' },
  { key: 'sun', label: 'Sekmadienis' },
];

const HOURS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

interface DaySchedule {
  active: boolean;
  open: string;
  close: string;
}

type WorkingHours = Record<string, DaySchedule>;

const DEFAULT_HOURS: WorkingHours = {
  mon: { active: true, open: '09:00', close: '18:00' },
  tue: { active: true, open: '09:00', close: '18:00' },
  wed: { active: true, open: '09:00', close: '18:00' },
  thu: { active: true, open: '09:00', close: '18:00' },
  fri: { active: true, open: '09:00', close: '18:00' },
  sat: { active: false, open: '10:00', close: '15:00' },
  sun: { active: false, open: '10:00', close: '15:00' },
};

const PLAN_LABELS: Record<number, string> = {
  5: 'Basic (max 5 km)',
  15: 'Pro (max 15 km)',
  50: 'Enterprise (max 50 km)',
};

export default function ProSettings({ proId, maxRadius = 5 }: { proId: string; maxRadius?: number }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const [hours, setHours] = useState<WorkingHours>(DEFAULT_HOURS);
  const [radius, setRadius] = useState(Math.min(10, maxRadius));

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('working_hours, pro_radius_km')
        .eq('id', proId)
        .single();

      if (data?.working_hours) {
        setHours({ ...DEFAULT_HOURS, ...data.working_hours });
      }
      if (data?.pro_radius_km) {
        // Clamp to plan limit in case user downgraded
        setRadius(Math.min(data.pro_radius_km, maxRadius));
      }
      setLoading(false);
    }
    load();
  }, [proId, maxRadius]);

  function toggleDay(key: string) {
    setHours(prev => ({
      ...prev,
      [key]: { ...prev[key], active: !prev[key].active },
    }));
  }

  function updateTime(key: string, field: 'open' | 'close', value: string) {
    setHours(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  function handleRadiusChange(val: number) {
    if (val > maxRadius) {
      setShowTooltip(true);
      setRadius(maxRadius);
      setTimeout(() => setShowTooltip(false), 3000);
      return;
    }
    setRadius(val);
    setShowTooltip(false);
  }

  async function save() {
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ working_hours: hours, pro_radius_km: radius })
      .eq('id', proId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Working hours */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-6 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-emerald-400" />
          <h2 className="font-bold text-white">Darbo laikas</h2>
        </div>

        <div className="space-y-1">
          {DAYS.map(({ key, label }) => {
            const day = hours[key];
            return (
              <div key={key} className="py-2.5 border-b border-gray-800/40 last:border-0">
                {/* Row 1: toggle + day name */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDay(key)}
                    className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${day.active ? 'bg-emerald-500' : 'bg-gray-700'}`}
                    aria-label={`Toggle ${label}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${day.active ? 'translate-x-4' : 'translate-x-0.5'}`}
                    />
                  </button>
                  <span className={`text-sm font-medium flex-1 ${day.active ? 'text-gray-200' : 'text-gray-600'}`}>
                    {label}
                  </span>
                  {!day.active && (
                    <span className="text-xs text-gray-600">Nedirbama</span>
                  )}
                </div>

                {/* Row 2: time pickers (only when active) */}
                {day.active && (
                  <div className="grid grid-cols-2 gap-2 mt-2 pl-13">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Nuo</label>
                      <select
                        value={day.open}
                        onChange={e => updateTime(key, 'open', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Iki</label>
                      <select
                        value={day.close}
                        onChange={e => updateTime(key, 'close', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Service radius */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-emerald-400" />
            <h2 className="font-bold text-white">Aptarnavimo spindulys</h2>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-800/60 px-3 py-1.5 rounded-xl">
            <Lock size={12} className="text-gray-500" />
            <span className="text-xs text-gray-400">{PLAN_LABELS[maxRadius] || `max ${maxRadius} km`}</span>
          </div>
        </div>

        <div className="space-y-3 relative">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Atstumas nuo tavęs</span>
            <span className="text-emerald-400 font-bold text-lg">{radius} km</span>
          </div>

          <div className="relative">
            <input
              type="range"
              min={1}
              max={maxRadius}
              value={radius}
              onChange={e => handleRadiusChange(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            {/* Tooltip */}
            {showTooltip && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 border border-amber-500/40 text-amber-400 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg z-10">
                Atnaujink planą kad padidintum spindulį
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs text-gray-600">
            <span>1 km</span>
            {maxRadius > 5 && <span>{Math.round(maxRadius / 2)} km</span>}
            <span>{maxRadius} km</span>
          </div>

          <p className="text-xs text-gray-500">
            Klientai iš {radius} km spindulio matys tavo pasiūlymus
          </p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-full transition-colors min-h-[44px]"
      >
        {saving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : saved ? (
          <Check size={16} />
        ) : null}
        {saved ? 'Išsaugota!' : 'Išsaugoti nustatymus'}
      </button>
    </div>
  );
}
