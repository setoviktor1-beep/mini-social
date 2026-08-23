'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

interface UsageInfo {
  used: number
  limit: number
}

export default function ProAIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(textToSend?: string) {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/pro-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          threadId: threadId || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'LIMIT_REACHED') {
          setError(data.message || 'Pasiektas mėnesio limitas.')
        } else if (data.error === 'SUBSCRIPTION_REQUIRED') {
          setError('AI chat prieinamas tik Pro ir Enterprise planams.')
        } else {
          setError(data.message || 'Įvyko klaida. Bandykite dar kartą.')
        }
        return
      }

      if (data.threadId && !threadId) {
        setThreadId(data.threadId)
      }

      setMessages([...updated, { role: 'assistant', text: data.reply }])
      if (data.usage) setUsage(data.usage)
    } catch {
      setError('Nepavyko prisijungti. Patikrinkite interneto ryšį.')
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const usedPct = usage ? Math.round((usage.used / usage.limit) * 100) : 0

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] max-h-[800px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Sparkles size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Verslo AI Asistentas</h3>
            <p className="text-xs text-gray-500">Padeda su klientais, kainomis ir verslu</p>
          </div>
        </div>
        {usage && (
          <div className="text-right">
            <div className="text-xs text-gray-500">
              {usage.used} / {usage.limit} žinučių
            </div>
            <div className="mt-1 w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-800/60 bg-gray-900/30 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Bot size={28} className="text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Sveiki! Aš jūsų verslo AI asistentas.</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                Galiu padėti su klientų komunikacija, kainų skaičiavimu, verslo patarimais ir užsakymų valdymu.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 w-full max-w-sm">
              {[
                'Kaip atsakyti klientui dėl vėlavimo?',
                'Apskaičiuok santechniko iškvietimo kainą',
                'Kaip padidinti užsakymų skaičių?',
                'Parašyk profesionalų pasiūlymą',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt)
                    send(prompt)
                  }}
                  className="text-left text-xs text-gray-400 bg-gray-800/60 hover:bg-gray-800 rounded-xl px-3 py-2 transition-colors border border-gray-700/50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-blue-500/20' : 'bg-emerald-500/20'
              }`}
            >
              {msg.role === 'user' ? (
                <User size={14} className="text-blue-400" />
              ) : (
                <Bot size={14} className="text-emerald-400" />
              )}
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-gray-800/80 text-gray-100 rounded-tl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-emerald-400" />
            </div>
            <div className="bg-gray-800/80 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              <span className="text-xs text-gray-400">Galvoju...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Klauskite apie klientus, kainas, verslo strategiją..."
          rows={1}
          className="flex-1 bg-gray-900/60 border border-gray-700/60 rounded-2xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-emerald-500/50 transition-colors"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0 self-end"
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
      <p className="text-xs text-gray-600 text-center mt-2">Enter — siųsti · Shift+Enter — nauja eilutė</p>
    </div>
  )
}
