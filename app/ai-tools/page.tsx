'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Loader2, Sparkles } from 'lucide-react'

type AIFeature = 'improve_post' | 'generate_reply' | 'toxicity_gate'

interface AIResponse {
  text: string
  balance: number
  cost: number
  tokens_input: number
  tokens_output: number
}

export default function AIToolsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [feature, setFeature] = useState<AIFeature>('improve_post')
  const [text, setText] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [balance, setBalance] = useState<number>(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AIResponse | null>(null)

  useEffect(() => {
    const loadBalance = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setBalanceLoading(false)
        setError('Please sign in to use AI tools.')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .maybeSingle()

      setBalance(Number(profile?.balance || 0))
      setBalanceLoading(false)
    }

    void loadBalance()
  }, [supabase])

  const runAI = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature,
          text: text.trim(),
          context: context.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'AI request failed')
        return
      }
      setResult(json as AIResponse)
      setBalance(Number(json?.balance || 0))
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={20} className="text-indigo-600" />
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">AI Tools</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Pay-per-use AI helpers for writing and moderation.</p>
        <div className="mt-4 inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl px-3 py-2">
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Current balance:</span>
          <span className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
            {balanceLoading ? 'Loading...' : `€${balance.toFixed(2)}`}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 p-5 sm:p-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFeature('improve_post')}
            className={`px-4 py-2 rounded-full text-sm font-semibold min-h-[40px] ${feature === 'improve_post' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >
            Improve Post
          </button>
          <button
            onClick={() => setFeature('generate_reply')}
            className={`px-4 py-2 rounded-full text-sm font-semibold min-h-[40px] ${feature === 'generate_reply' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >
            Generate Reply
          </button>
          <button
            onClick={() => setFeature('toxicity_gate')}
            className={`px-4 py-2 rounded-full text-sm font-semibold min-h-[40px] ${feature === 'toxicity_gate' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          >
            Toxicity Gate
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text..."
          maxLength={2000}
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-300 min-h-[130px] bg-white dark:bg-gray-800 dark:text-gray-200"
        />

        {feature === 'generate_reply' && (
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Optional context..."
            maxLength={2000}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-300 min-h-[90px] bg-white dark:bg-gray-800 dark:text-gray-200"
          />
        )}

        <button
          onClick={runAI}
          disabled={loading || !text.trim()}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-indigo-700 disabled:opacity-60 min-h-[44px] flex items-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Running...' : 'Run AI'}
        </button>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4">
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{result.text}</p>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Cost: €{Number(result.cost || 0).toFixed(4)} | Tokens: {result.tokens_input}/{result.tokens_output} | Balance: €{Number(result.balance || 0).toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

