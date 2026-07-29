"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/backend-client';
import { Plus, Pencil, Trash2, Check, X, Tag, Loader2 } from 'lucide-react';

type PriceType = 'fixed' | 'hourly' | 'from';

interface ProService {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_type: PriceType;
  is_active: boolean;
}

const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  fixed: 'Fiksuota',
  hourly: 'Per val.',
  from: 'Nuo',
};

export default function ServicesCatalog({ proId }: { proId: string }) {
  const supabase = createClient();
  const [services, setServices] = useState<ProService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState<PriceType>('fixed');

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    const { data } = await supabase
      .from('pro_services')
      .select('*')
      .eq('pro_id', proId)
      .order('created_at', { ascending: true });
    setServices(data || []);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setPriceType('fixed');
    setShowForm(true);
  }

  function openEdit(s: ProService) {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description || '');
    setPrice(s.price !== null ? String(s.price) : '');
    setPriceType(s.price_type);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function saveService() {
    if (!name.trim()) return;
    setSaving(true);

    const payload = {
      pro_id: proId,
      name: name.trim(),
      description: description.trim() || null,
      price: price !== '' ? parseFloat(price) : null,
      price_type: priceType,
      is_active: true,
    };

    if (editingId) {
      const { data } = await supabase
        .from('pro_services')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();
      if (data) setServices(services.map(s => s.id === editingId ? data : s));
    } else {
      const { data } = await supabase
        .from('pro_services')
        .insert(payload)
        .select()
        .single();
      if (data) setServices([...services, data]);
    }

    setSaving(false);
    cancelForm();
  }

  async function deleteService(id: string) {
    await supabase.from('pro_services').delete().eq('id', id);
    setServices(services.filter(s => s.id !== id));
  }

  async function toggleActive(s: ProService) {
    const { data } = await supabase
      .from('pro_services')
      .update({ is_active: !s.is_active })
      .eq('id', s.id)
      .select()
      .single();
    if (data) setServices(services.map(x => x.id === s.id ? data : x));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          {services.length === 0
            ? 'Dar nėra paslaugų. Pridėk pirmąją!'
            : `${services.length} paslauga(-os)`}
        </p>
        {!showForm && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-full transition-colors text-sm"
          >
            <Plus size={16} /> Pridėti paslaugą
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-gray-900 border border-emerald-800/50 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white text-sm">
            {editingId ? 'Redaguoti paslaugą' : 'Nauja paslauga'}
          </h3>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Pavadinimas *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="pvz. Santechnikos darbai"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Aprašymas</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Trumpas paslaugos aprašymas..."
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Kaina (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Kainos tipas</label>
              <select
                value={priceType}
                onChange={e => setPriceType(e.target.value as PriceType)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              >
                <option value="fixed">Fiksuota</option>
                <option value="hourly">Per val.</option>
                <option value="from">Nuo</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={saveService}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-5 rounded-xl transition-colors text-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Išsaugoti
            </button>
            <button
              onClick={cancelForm}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2 px-4 rounded-xl transition-colors text-sm"
            >
              <X size={14} /> Atšaukti
            </button>
          </div>
        </div>
      )}

      {/* Services List */}
      <div className="grid gap-3">
        {services.map(s => (
          <div
            key={s.id}
            className={`bg-gray-900 border rounded-2xl p-4 flex items-start gap-4 transition-opacity ${s.is_active ? 'border-gray-800' : 'border-gray-800/40 opacity-50'}`}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-900/30 flex items-center justify-center shrink-0">
              <Tag size={16} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">{s.name}</span>
                {!s.is_active && (
                  <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">Neaktyvi</span>
                )}
              </div>
              {s.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>
              )}
              {s.price !== null && (
                <p className="text-emerald-400 font-bold text-sm mt-1">
                  {PRICE_TYPE_LABELS[s.price_type]} {s.price}€
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => toggleActive(s)}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-200 transition-colors text-xs"
                title={s.is_active ? 'Išjungti' : 'Įjungti'}
              >
                {s.is_active ? 'Išjungti' : 'Įjungti'}
              </button>
              <button
                onClick={() => openEdit(s)}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-200 transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => deleteService(s.id)}
                className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {services.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-600">
          <Tag size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Pridėk paslaugas, kad klientai žinotų ką siūlai</p>
        </div>
      )}
    </div>
  );
}
