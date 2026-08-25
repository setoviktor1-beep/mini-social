'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Send,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  MessageSquare,
  Menu,
  RotateCcw,
  Copy,
  CheckCheck,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface Thread {
  id: string
  title: string
  updated_at: string
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export default function AIChatClient() {
  const { t } = useI18n()
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load threads on mount
  useEffect(() => {
    fetchThreads()
  }, [])

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function fetchThreads() {
    try {
      setLoadingThreads(true)
      const res = await fetch('/api/ai/threads')
      if (res.ok) {
        const data = await res.json()
        setThreads(data.threads || [])
      }
    } catch {
      // Non-blocking error
    } finally {
      setLoadingThreads(false)
    }
  }

  async function selectThread(threadId: string) {
    if (threadId === activeThreadId) {
      setSidebarOpen(false)
      return
    }

    setActiveThreadId(threadId)
    setSidebarOpen(false)
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/ai/threads/${threadId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      } else {
        setError(t('ai.unavailable', 'Nepavyko užkrauti pokalbio.'))
        setMessages([])
      }
    } catch {
      setError(t('ai.unavailable', 'Tinklo klaida. Patikrinkite ryšį.'))
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  function startNewChat() {
    setActiveThreadId(null)
    setMessages([])
    setError(null)
    setSidebarOpen(false)
    textareaRef.current?.focus()
  }

  async function sendMessage(textToSend?: string) {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    const userMessage: Message = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: activeThreadId,
          message: text,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(
          data?.error === 'AI_RATE_LIMITED'
            ? t('ai.rateLimited', 'Per daug užklausų. Bandykite šiek tiek vėliau.')
            : t('ai.unavailable', 'MiniSocial AI šiuo metu nepasiekiamas. Pabandykite dar kartą po kelių akimirkų.'),
        )
        return
      }

      if (data.threadId && data.threadId !== activeThreadId) {
        setActiveThreadId(data.threadId)
        fetchThreads()
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      }

      setMessages([...updatedMessages, assistantMessage])
    } catch {
      setError(t('ai.unavailable', 'MiniSocial AI šiuo metu nepasiekiamas. Pabandykite dar kartą po kelių akimirkų.'))
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  async function deleteThread(threadId: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/ai/threads/${threadId}`, { method: 'DELETE' })
      if (res.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId))
        if (activeThreadId === threadId) {
          startNewChat()
        }
      }
    } catch {
      // Non-blocking
    }
  }

  async function renameThread(threadId: string, newTitle: string) {
    if (!newTitle.trim()) return
    try {
      const res = await fetch(`/api/ai/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      if (res.ok) {
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, title: newTitle.trim() } : t)),
        )
      }
    } catch {
      // Non-blocking
    } finally {
      setEditingThreadId(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function copyToClipboard(content: string, index: number) {
    navigator.clipboard.writeText(content).catch(() => {})
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const starterPrompts = [
    t('ai.promptIdea', 'Sugalvok įrašo idėją'),
    t('ai.promptService', 'Padėk parašyti paslaugos aprašymą'),
    t('ai.promptContent', 'Surask aktualų turinį MiniSocial'),
    t('ai.promptReply', 'Padėk atsakyti klientui'),
  ]

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-6xl mx-auto rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm relative">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* History Sidebar */}
      <aside
        className={`w-72 bg-gray-50/80 dark:bg-gray-900/60 border-r border-gray-200 dark:border-gray-800 flex flex-col z-40 transition-transform duration-200 absolute md:static inset-y-0 left-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-gray-200/80 dark:border-gray-800 flex items-center justify-between">
          <button
            onClick={startNewChat}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white font-semibold text-xs py-2.5 px-3 rounded-2xl shadow-sm hover:opacity-95 transition-all active:scale-[0.98]"
          >
            <Plus size={15} />
            <span>{t('ai.newChat', 'Naujas pokalbis')}</span>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden ml-2 p-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 rounded-xl"
            aria-label={t('ai.close', 'Uždaryti')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loadingThreads ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400 dark:text-gray-500">
              {t('ai.noHistory', 'Dar nėra išsaugotų pokalbių.')}
            </div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => selectThread(thread.id)}
                className={`group flex items-center justify-between gap-2 p-2.5 rounded-2xl cursor-pointer text-xs transition-all border ${
                  activeThreadId === thread.id
                    ? 'bg-violet-50/80 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200 border-violet-200 dark:border-violet-800 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-100/70 dark:hover:bg-gray-800/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare size={14} className="shrink-0 text-gray-400" />
                  {editingThreadId === thread.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameThread(thread.id, editingTitle)
                        if (e.key === 'Escape') setEditingThreadId(null)
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-white dark:bg-gray-800 border border-violet-300 rounded px-1 text-xs"
                    />
                  ) : (
                    <span className="truncate">{thread.title}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editingThreadId === thread.id ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        renameThread(thread.id, editingTitle)
                      }}
                      className="p-1 hover:text-green-600"
                    >
                      <Check size={12} />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingThreadId(thread.id)
                        setEditingTitle(thread.title)
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <Edit2 size={12} />
                    </button>
                  )}
                  <button
                    onClick={(e) => deleteThread(thread.id, e)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat View */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900">
        {/* Top Header */}
        <div className="h-16 px-4 sm:px-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 rounded-xl"
              aria-label={t('ai.history', 'Pokalbių istorija')}
            >
              <Menu size={18} />
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white shadow-md shadow-violet-500/25">
              <Sparkles size={18} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {t('ai.assistantTitle', 'MiniSocial AI')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('ai.assistantSubtitle', 'Jūsų asmeninis MiniSocial asistentas')}
              </p>
            </div>
          </div>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-12">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center mb-4 text-white shadow-lg shadow-violet-500/25">
                <Sparkles size={30} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {t('ai.welcomeTitle', 'Kuo galiu padėti?')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                {t(
                  'ai.welcomeSubtitle',
                  'Galiu padėti su MiniSocial, turiniu, paslaugomis, paieška ir kasdienėmis užduotimis.',
                )}
              </p>

              {/* Starter Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 w-full">
                {starterPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(prompt)
                      sendMessage(prompt)
                    }}
                    className="text-left text-xs p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-violet-400 dark:hover:border-violet-700 bg-gray-50 dark:bg-gray-800/40 hover:bg-violet-50/50 dark:hover:bg-violet-950/30 text-gray-700 dark:text-gray-300 transition-all active:scale-[0.98] shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              } max-w-3xl ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                  <Sparkles size={12} className="text-violet-500" />
                  <span>MiniSocial AI</span>
                </div>
              )}

              <div
                className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#1A1A2E] text-white dark:bg-blue-600 rounded-tr-sm shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 rounded-tl-sm border border-gray-200/60 dark:border-gray-700/60 shadow-sm'
                }`}
              >
                {msg.role === 'assistant'
                  ? msg.content
                      .replace(/`{3,}(?:tool_call|tool_code|function_call|tool)[\s\S]*?`{3,}/gi, '')
                      .replace(/`{3,}(?:json)?\s*\{\s*["'](?:tool|function|action)["']\s*:\s*["'][^"']+["'][\s\S]*?\}\s*`{3,}/gi, '')
                      .replace(/<(?:tool_call|tool_code|function_call|tool)>[\s\S]*?<\/(?:tool_call|tool_code|function_call|tool)>/gi, '')
                      .replace(/<\/?(?:tool_call|tool_code|function_call|tool)[^>]*>/gi, '')
                      .trim() || t('ai.unavailable', 'Atsiprašome, įvyko klaida.')
                  : msg.content}
              </div>

              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 text-[11px] text-gray-400 px-1 mt-1">
                  <button
                    onClick={() => copyToClipboard(msg.content, idx)}
                    className="hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <CheckCheck size={12} className="text-emerald-500" />
                        <span className="text-emerald-500">{t('ai.copied', 'Nukopijuota')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>{t('ai.copy', 'Kopijuoti')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center shrink-0 text-white shadow-sm">
                <Sparkles size={15} />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800/90 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 border border-gray-200/60 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 shadow-sm">
                <Loader2 size={15} className="animate-spin text-violet-600 dark:text-violet-400" />
                <span className="text-xs">{t('ai.thinking', 'AI galvoja...')}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => sendMessage(messages[messages.length - 1]?.content)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-100 dark:bg-red-900/50 hover:bg-red-200 font-semibold transition-colors"
              >
                <RotateCcw size={12} />
                <span>{t('ai.retry', 'Pakartoti')}</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 sm:p-4 border-t border-gray-200 dark:border-gray-800 shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md">
          <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-3xl p-1.5 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all shadow-sm">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('ai.inputPlaceholder', 'Paklauskite MiniSocial AI...')}
              rows={1}
              className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none outline-none max-h-32 min-h-[38px]"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all shrink-0 active:scale-95 shadow-sm mb-0.5"
              aria-label={t('ai.send', 'Siųsti žinutę')}
            >
              <Send size={14} />
            </button>
          </div>
          <div className="text-[10px] text-gray-400 text-center mt-1.5">
            {t('ai.inputHint', 'Shift + Enter naujai eilutei • Enter siuntimui')}
          </div>
        </div>
      </main>
    </div>
  )
}
