'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'

type Feature = 'improve_post' | 'generate_reply' | 'toxicity_gate'

interface AIResponse {
  text?: string
  ok?: boolean
  reason?: string
  suggestion?: string
  error?: string
  cost?: number
  balance?: number
}

export default function AITools() {
  const [input, setInput] = useState('')
  const [context, setContext] = useState('')
  const [feature, setFeature] = useState<Feature>('improve_post')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIResponse | null>(null)

  const runAI = async () => {
    if (!input.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature,
          text: input.trim(),
          context: context.trim() || undefined,
        }),
      })
      const json = await res.json()
      setResult(json)
    } catch {
      setResult({ error: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50">
        <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
          <Sparkles size={20} className="text-indigo-600" />
          AI Tools
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Improve text, generate replies, and check toxicity</p>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'improve_post', label: 'Improve Post' },
            { key: 'generate_reply', label: 'Generate Reply' },
            { key: 'toxicity_gate', label: 'Toxicity Gate' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFeature(f.key as Feature)}
              className={`px-4 py-2 rounded-full text-sm font-semibold min-h-[40px] ${
                feature === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write text..."
          maxLength={2000}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-300 min-h-[120px]"
        />

        {feature === 'generate_reply' && (
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Optional context..."
            maxLength={2000}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-300 min-h-[90px]"
          />
        )}

        <button
          onClick={runAI}
          disabled={loading || !input.trim()}
          className="px-6 py-2.5 rounded-full bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60 min-h-[44px]"
        >
          {loading ? 'Processing...' : 'Run AI'}
        </button>

        {result?.error === 'INSUFFICIENT_BALANCE' && (
          <p className="text-sm font-semibold text-red-600">Insufficient balance. Please top up wallet.</p>
        )}

        {result && !result.error && (
          <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-2">
            {feature === 'toxicity_gate' ? (
              <>
                <p className={`text-sm font-bold ${result.ok ? 'text-green-700' : 'text-red-700'}`}>
                  {result.ok ? 'Looks safe' : 'Potentially toxic'}
                </p>
                {!!result.reason && <p className="text-sm text-gray-700">Reason: {result.reason}</p>}
                {!!result.suggestion && <p className="text-sm text-gray-700">Suggestion: {result.suggestion}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.text}</p>
            )}
            <p className="text-xs text-gray-500">
              Cost: €{Number(result.cost || 0).toFixed(4)} | Balance: €{Number(result.balance || 0).toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

