'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bot, Power, Save, Bell, Mail, Loader2, Check, AlertCircle, ChevronDown, ChevronUp, Inbox } from 'lucide-react'

const DAYS = ['Pirmadienis', 'Antradienis', 'Trečiadienis', 'Ketvirtadienis', 'Penktadienis', 'Šeštadienis', 'Sekmadienis']
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)

interface Trigger {
  type: string
  enabled: boolean
  threshold?: number
  period?: string
  days?: number
}

interface AgentConfig {
  is_enabled: boolean
  agent_name: string
  personality: string
  report_frequency: string
  report_day: number
  report_hour: number
  triggers: Trigger[]
}

interface AgentMessage {
  id: string
  content: string
  message_type: string
  is_read: boolean
  created_at: string
}

const DEFAULT_CONFIG: AgentConfig = {
  is_enabled: false,
  agent_name: 'Mano Agentas',
  personality: 'profesionalus ir glaustas',
  report_frequency: 'weekly',
  report_day: 1,
  report_hour: 8,
  triggers: [
    { type: 'no_orders', enabled: false, days: 3 },
    { type: 'new_client', enabled: false },
    { type: 'orders_drop', enabled: false, threshold: 20, period: 'week' },
  ],
}

export default function ProAgent({ isEnterprise }: { isEnterprise: boolean }) {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'config' | 'inbox'>('config')
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!isEnterprise) { setLoading(false); return }
    const [configRes, msgRes] = await Promise.all([
      fetch('/api/agent/config'),
      fetch('/api/agent/messages'),
    ])
    if (configRes.ok) {
      const { config: c } = await configRes.json()
      if (c) setConfig(c)
    }
    if (msgRes.ok) {
      const { messages: m } = await msgRes.json()
      setMessages(m)
    }
    setLoading(false)
  }, [isEnterprise])

  useEffect(() => { fetchData() }, [fetchData])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/agent/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  async function markRead(id: string) {
    await fetch('/api/agent/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m))
  }

  async function markAllRead() {
    await fetch('/api/agent/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'all' }),
    })
    setMessages(prev => prev.map(m => ({ ...m, is_read: true })))
  }

  function updateTrigger(type: string, patch: Partial<Trigger>) {
    setConfig(prev => ({
      ...prev,
      triggers: prev.triggers.map(t => t.type === type ? { ...t, ...patch } : t),
    }))
  }

  const unreadCount = messages.filter(m => !m.is_read).length

  if (!isEnterprise) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center">
          <Bot size={32} className="text-purple-400" />
        </div>
        <h3 className="text-white font-bold text-lg">AI Agentas — Enterprise funkcija</h3>
        <p className="text-gray-500 text-sm text-center max-w-xs">
          Pilna agento automatizacija prieinama tik Enterprise plane (€89.99/mėn).
          Agentas savarankiškai stebi jūsų verslą, siunčia ataskaitas ir perspėjimus.
        </p>
        <a
          href="/pricing"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-2xl transition-colors"
        >
          Peržiūrėti Enterprise planą
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 flex items-center justify-center">
            <Bot size={20} className="text-purple-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">AI Agentas</h3>
            <p className="text-xs text-gray-500">Automatiškai stebi verslą ir siunčia žinutes</p>
          </div>
        </div>
        {/* On/Off toggle */}
        <button
          onClick={() => setConfig(p => ({ ...p, is_enabled: !p.is_enabled }))}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
            config.is_enabled
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          <Power size={16} />
          {config.is_enabled ? 'Įjungtas' : 'Išjungtas'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800/60">
        <button
          onClick={() => setTab('config')}
          className={`px-4 py-3 text-sm font-bold transition-colors border-b-2 ${
            tab === 'config' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Konfigūracija
        </button>
        <button
          onClick={() => setTab('inbox')}
          className={`px-4 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
            tab === 'inbox' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Inbox size={15} />
          Žinutės
          {unreadCount > 0 && (
            <span className="bg-purple-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'config' && (
        <div className="space-y-6">
          {/* Agent identity */}
          <div className="bg-gray-900/40 rounded-2xl border border-gray-800/60 p-5 space-y-4">
            <h4 className="font-bold text-white text-sm flex items-center gap-2"><Bot size={15} className="text-purple-400" /> Agento tapatybė</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Agento vardas</label>
                <input
                  value={config.agent_name}
                  onChange={e => setConfig(p => ({ ...p, agent_name: e.target.value }))}
                  className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  placeholder="Mano Agentas"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bendravimo stilius</label>
                <select
                  value={config.personality}
                  onChange={e => setConfig(p => ({ ...p, personality: e.target.value }))}
                  className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="profesionalus ir glaustas">Profesionalus ir glaustas</option>
                  <option value="draugiškas ir šiltas">Draugiškas ir šiltas</option>
                  <option value="analitiškas ir detalus">Analitiškas ir detalus</option>
                  <option value="motyvuojantis ir energingas">Motyvuojantis ir energingas</option>
                </select>
              </div>
            </div>
          </div>

          {/* Scheduled reports */}
          <div className="bg-gray-900/40 rounded-2xl border border-gray-800/60 p-5 space-y-4">
            <h4 className="font-bold text-white text-sm flex items-center gap-2"><Bell size={15} className="text-purple-400" /> Automatinės ataskaitos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Dažnumas</label>
                <select
                  value={config.report_frequency}
                  onChange={e => setConfig(p => ({ ...p, report_frequency: e.target.value }))}
                  className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="never">Niekada</option>
                  <option value="daily">Kasdien</option>
                  <option value="weekly">Kas savaitę</option>
                  <option value="monthly">Kas mėnesį</option>
                </select>
              </div>

              {config.report_frequency === 'weekly' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Savaitės diena</label>
                  <select
                    value={config.report_day}
                    onChange={e => setConfig(p => ({ ...p, report_day: +e.target.value }))}
                    className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {DAYS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
                  </select>
                </div>
              )}

              {config.report_frequency === 'monthly' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Mėnesio diena</label>
                  <input
                    type="number" min={1} max={28}
                    value={config.report_day}
                    onChange={e => setConfig(p => ({ ...p, report_day: +e.target.value }))}
                    className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Siuntimo laikas</label>
                <select
                  value={config.report_hour}
                  onChange={e => setConfig(p => ({ ...p, report_hour: +e.target.value }))}
                  className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                >
                  {HOURS.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Triggers */}
          <div className="bg-gray-900/40 rounded-2xl border border-gray-800/60 p-5 space-y-4">
            <h4 className="font-bold text-white text-sm flex items-center gap-2"><AlertCircle size={15} className="text-purple-400" /> Triggeriai (automatiniai perspėjimai)</h4>

            {/* No orders trigger */}
            <div className="flex items-center justify-between gap-4 p-3 bg-gray-800/40 rounded-xl">
              <div className="flex-1">
                <div className="text-sm text-white font-medium">Nėra užsakymų</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">Per</span>
                  <input
                    type="number" min={1} max={30}
                    value={config.triggers.find(t => t.type === 'no_orders')?.days || 3}
                    onChange={e => updateTrigger('no_orders', { days: +e.target.value })}
                    className="w-14 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white text-center"
                  />
                  <span className="text-xs text-gray-500">dienas — perspėk mane</span>
                </div>
              </div>
              <button
                onClick={() => updateTrigger('no_orders', { enabled: !config.triggers.find(t => t.type === 'no_orders')?.enabled })}
                className={`w-11 h-6 rounded-full transition-colors relative ${config.triggers.find(t => t.type === 'no_orders')?.enabled ? 'bg-purple-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.triggers.find(t => t.type === 'no_orders')?.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* New client trigger */}
            <div className="flex items-center justify-between gap-4 p-3 bg-gray-800/40 rounded-xl">
              <div>
                <div className="text-sm text-white font-medium">Naujas užsakymas</div>
                <div className="text-xs text-gray-500 mt-0.5">Perspėk kai gaunamas naujas užsakymas</div>
              </div>
              <button
                onClick={() => updateTrigger('new_client', { enabled: !config.triggers.find(t => t.type === 'new_client')?.enabled })}
                className={`w-11 h-6 rounded-full transition-colors relative ${config.triggers.find(t => t.type === 'new_client')?.enabled ? 'bg-purple-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.triggers.find(t => t.type === 'new_client')?.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Orders drop trigger */}
            <div className="flex items-center justify-between gap-4 p-3 bg-gray-800/40 rounded-xl">
              <div className="flex-1">
                <div className="text-sm text-white font-medium">Užsakymų kritimas</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500">Jei krenta daugiau nei</span>
                  <input
                    type="number" min={5} max={100}
                    value={config.triggers.find(t => t.type === 'orders_drop')?.threshold || 20}
                    onChange={e => updateTrigger('orders_drop', { threshold: +e.target.value })}
                    className="w-14 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white text-center"
                  />
                  <span className="text-xs text-gray-500">%</span>
                  <select
                    value={config.triggers.find(t => t.type === 'orders_drop')?.period || 'week'}
                    onChange={e => updateTrigger('orders_drop', { period: e.target.value })}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option value="week">per savaitę</option>
                    <option value="month">per mėnesį</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => updateTrigger('orders_drop', { enabled: !config.triggers.find(t => t.type === 'orders_drop')?.enabled })}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${config.triggers.find(t => t.type === 'orders_drop')?.enabled ? 'bg-purple-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.triggers.find(t => t.type === 'orders_drop')?.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-2xl transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? 'Išsaugota!' : 'Išsaugoti nustatymus'}
          </button>
        </div>
      )}

      {tab === 'inbox' && (
        <div className="space-y-3">
          {messages.length > 0 && unreadCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={markAllRead}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Pažymėti visas kaip perskaitytas
              </button>
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Mail size={32} className="text-gray-700" />
              <p className="text-gray-500 text-sm">Dar nėra žinučių iš agento</p>
              <p className="text-gray-600 text-xs">Įjunkite agentą ir sukonfigūruokite ataskaitas</p>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`rounded-2xl border p-4 transition-all ${
                msg.is_read
                  ? 'border-gray-800/60 bg-gray-900/20'
                  : 'border-purple-500/30 bg-purple-500/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${msg.is_read ? 'bg-gray-700' : 'bg-purple-500'}`} />
                  <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      msg.message_type === 'report'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-orange-500/15 text-orange-400'
                    }`}>
                      {msg.message_type === 'report' ? 'Ataskaita' : 'Perspėjimas'}
                    </span>
                    <span className="text-xs text-gray-600 ml-2">
                      {new Date(msg.created_at).toLocaleDateString('lt-LT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedMsg(expandedMsg === msg.id ? null : msg.id)}
                  className="text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {expandedMsg === msg.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              <div
                className={`mt-2 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap overflow-hidden transition-all ${
                  expandedMsg === msg.id ? '' : 'line-clamp-2'
                }`}
              >
                {msg.content}
              </div>

              {!msg.is_read && (
                <button
                  onClick={() => markRead(msg.id)}
                  className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Pažymėti kaip perskaitytą
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
