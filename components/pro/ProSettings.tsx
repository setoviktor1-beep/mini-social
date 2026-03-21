"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Clock, MapPin, Loader2, Check } from 'lucide-react';

const DAYS = [
  { key: 'mon', label: 'Pirmadienis' },
  { key: 'tue', label: 'Antradienis' },
  { key: 'wed', label: 'Trečiadienis' },
  { key: 'thu', label: 'Ketvirtadienis' },
  { key: 'fri', label: 'Penktadienis' },
  { key: 'sat', label: 'Šeštadienis' },
  { key: 'sun', label: 'Sekmadienis' },
];

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

export default function ProSettings({ proId }: { proId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [hours, setHours] = useState<WorkingHours>(DEFAULT_HOURS);
  const [radius, setRadius] = useState(10);

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
        setRadius(data.pro_radius_km);
      }
      setLoading(false);
    }
    load();
  }, [proId]);

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
    <div className="space-y-8 max-w-2xl">
      {/* Working hours */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={18} className="text-emerald-400" />
          <h2 className="font-bold text-white">Darbo laikas</h2>
        </div>

        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const day = hours[key];
            return (
              <div key={key} className="flex items-center gap-3 py-2">
                <button
                  onClick={() => toggleDay(key)}
                  className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${day.active ? 'bg-emerald-500' : 'bg-gray-700'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${day.active ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
                <span className={`text-sm w-28 shrink-0 ${day.active ? 'text-gray-200' : 'text-gray-600'}`}>
                  {label}
                </span>
                {day.active ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.open}
                      onChange={e => updateTime(key, 'open', e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-600"
                    />
                    <span className="text-gray-600 text-xs">—</span>
                    <input
                      type="time"
                      value={day.close}
                      onChange={e => updateTime(key, 'close', e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-gray-600">Nedirbama</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Service radius */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-emerald-400" />
          <h2 className="font-bold text-white">Aptarnavimo spindulys</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Atstumas nuo tavęs</span>
            <span className="text-emerald-400 font-bold text-lg">{radius} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>1 km</span>
            <span>25 km</span>
            <span>50 km</span>
          </div>
          <p className="text-xs text-gray-500">
            Klientai iš {radius} km spindulio matys tavo pasiūlymus
          </p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-full transition-colors"
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
