"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/backend-client';
import { Plus, Trash2, Copy, Check, MessageSquare, Loader2, X } from 'lucide-react';

interface QuickReply {
  id: string;
  label: string;
  body: string;
}

export default function QuickReplies({ proId }: { proId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');

  const DEFAULT_TEMPLATES = [
    { label: 'Esu kelyje', body: 'Sveiki! Esu kelyje, greitai būsiu pas jus.' },
    { label: 'Užsakymas paruoštas', body: 'Jūsų užsakymas paruoštas ir laukia!' },
    { label: 'Reikia daugiau info', body: 'Sveiki, norėčiau sužinoti daugiau detalių apie jūsų užklausą.' },
    { label: 'Patvirtinu laiką', body: 'Patvirtinu susitikimą nurodytu laiku. Iki pasimatymo!' },
  ];

  const fetchReplies = useCallback(async () => {
    const { data } = await supabase
      .from('quick_reply_templates')
      .select('*')
      .eq('pro_id', proId)
      .order('created_at', { ascending: true });
    setReplies(data || []);
    setLoading(false);
  }, [supabase, proId]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  async function addTemplate(tmpl: { label: string; body: string }) {
    setSaving(true);
    const { data } = await supabase
      .from('quick_reply_templates')
      .insert({ pro_id: proId, label: tmpl.label, body: tmpl.body })
      .select()
      .single();
    if (data) setReplies(prev => [...prev, data]);
    setSaving(false);
  }

  async function saveCustom() {
    if (!label.trim() || !body.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from('quick_reply_templates')
      .insert({ pro_id: proId, label: label.trim(), body: body.trim() })
      .select()
      .single();
    if (data) setReplies(prev => [...prev, data]);
    setSaving(false);
    setShowForm(false);
    setLabel('');
    setBody('');
  }

  async function deleteReply(id: string) {
    await supabase.from('quick_reply_templates').delete().eq('id', id);
    setReplies(replies.filter(r => r.id !== id));
  }

  async function copyToClipboard(reply: QuickReply) {
    await navigator.clipboard.writeText(reply.body);
    setCopiedId(reply.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  const usedLabels = new Set(replies.map(r => r.label));
  const availableDefaults = DEFAULT_TEMPLATES.filter(t => !usedLabels.has(t.label));

  return (
    <div className="space-y-6">
      {/* Saved replies */}
      {replies.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Tavo šablonai</p>
          {replies.map(r => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-400 mb-1">{r.label}</p>
                <p className="text-sm text-gray-300">{r.body}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => copyToClipboard(r)}
                  className="p-2 rounded-xl hover:bg-gray-800 text-gray-500 hover:text-gray-200 transition-colors"
                  title="Kopijuoti"
                >
                  {copiedId === r.id ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                </button>
                <button
                  onClick={() => deleteReply(r.id)}
                  className="p-2 rounded-xl hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom form */}
      {showForm ? (
        <div className="bg-gray-900 border border-emerald-800/50 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Naujas šablonas</h3>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Etiketė (trumpas pavadinimas)</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="pvz. Patvirtinimas"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Žinutės tekstas</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Šabloninė žinutė..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveCustom}
              disabled={saving || !label.trim() || !body.trim()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Išsaugoti
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2 px-4 rounded-xl text-sm transition-colors"
            >
              <X size={14} /> Atšaukti
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2 px-4 rounded-xl text-sm transition-colors"
        >
          <Plus size={15} /> Sukurti savo šabloną
        </button>
      )}

      {/* Default templates to add */}
      {availableDefaults.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Pasiūlyti šablonai</p>
          {availableDefaults.map(tmpl => (
            <div key={tmpl.label} className="bg-gray-900/50 border border-gray-800/50 border-dashed rounded-2xl p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-500 mb-1">{tmpl.label}</p>
                <p className="text-sm text-gray-500">{tmpl.body}</p>
              </div>
              <button
                onClick={() => addTemplate(tmpl)}
                disabled={saving}
                className="shrink-0 flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-1.5 px-3 rounded-xl text-xs transition-colors"
              >
                <Plus size={13} /> Pridėti
              </button>
            </div>
          ))}
        </div>
      )}

      {replies.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-600">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Pridėk šablonus ir atsakyk klientams vienu paspaudimu</p>
        </div>
      )}
    </div>
  );
}
