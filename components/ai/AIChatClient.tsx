'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Send,
  Bot,
  User,
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
  model?: string
  provider?: string
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
        setError(t('ai.thread_load_error', 'Nepavyko užkrauti pokalbio.'))
        setMessages([])
      }
    } catch {
      setError(t('ai.network_error', 'Tinklo klaida. Patikrinkite ryšį.'))
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
        setError(data.message || t('ai.generic_error', 'Įvyko klaida siunčiant žinutę.'))
        return
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply,
        model: data.model,
        provider: data.provider,
        created_at: new Date().toISOString(),
      }

      setMessages([...updatedMessages, assistantMessage])

      if (!activeThreadId && data.threadId) {
        setActiveThreadId(data.threadId)
        fetchThreads()
      }
    } catch {
      setError(t('ai.network_error', 'Tinklo klaida. Bandykite dar kartą.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleRename(threadId: string) {
    if (!editingTitle.trim()) {
      setEditingThreadId(null)
      return
    }

    try {
      const res = await fetch(`/api/ai/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle.trim() }),
      })

      if (res.ok) {
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, title: editingTitle.trim() } : t)),
        )
      }
    } catch {
    } finally {
      setEditingThreadId(null)
    }
  }

  async function handleDelete(e: React.MouseEvent, threadId: string) {
    e.stopPropagation()
    if (!confirm(t('ai.confirm_delete', 'Ar tikrai norite ištrinti šį pokalbį?'))) return

    try {
      const res = await fetch(`/api/ai/threads/${threadId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId))
        if (activeThreadId === threadId) {
          startNewChat()
        }
      }
    } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const starterPrompts = [
    t('ai.prompt_post', 'Pasiūlyk 3 įtraukiančias idėjas mano naujam įrašui'),
    t('ai.prompt_profile', 'Padėk patobulinti mano profilio aprašymą'),
    t('ai.prompt_business', 'Kaip efektyviai atsakyti į kliento užklausą?'),
    t('ai.prompt_summary', 'Kokie yra svarbiausi socialinio tinklo bendravimo patarimai?'),
  ]

  return (
    <div className="flex h-[calc(100vh-110px)] max-w-6xl mx-auto rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden relative">
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: Threads List */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-72 bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <button
            onClick={startNewChat}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} />
            <span>{t('ai.new_chat', 'Naujas pokalbis')}</span>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-2 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thread History Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingThreads ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-gray-400">
              {t('ai.no_threads', 'Nėra ankstesnių pokalbių')}
            </div>
          ) : (
            threads.map((thread) => {
              const isActive = thread.id === activeThreadId
              const isEditing = thread.id === editingThreadId

              return (
                <div
                  key={thread.id}
                  onClick={() => !isEditing && selectThread(thread.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                    <MessageSquare size={15} className="shrink-0 opacity-70" />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(thread.id)
                          if (e.key === 'Escape') setEditingThreadId(null)
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-gray-800 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-gray-900 dark:text-gray-100 w-full outline-none"
                      />
                    ) : (
                      <span className="truncate">{thread.title}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    {isEditing ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRename(thread.id)
                          }}
                          className="p-1 hover:text-green-600"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingThreadId(null)
                          }}
                          className="p-1 hover:text-gray-500"
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingThreadId(thread.id)
                            setEditingTitle(thread.title)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, thread.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">
        {/* Chat Header */}
        <div className="px-4 py-3.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
              aria-label="Open chat history"
            >
              <Menu size={18} />
            </button>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                MiniSocial AI
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  OmniRouter
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('ai.chat_subtitle', 'Privatus asistentas su Gemini & NVIDIA modeliais')}
              </p>
            </div>
          </div>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-12">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/60">
                <Bot size={32} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {t('ai.welcome_title', 'Kuo galiu padėti šiandien?')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                {t(
                  'ai.welcome_desc',
                  'Klauskite apie įrašų kūrimą, verslo statistiką, paslaugas ar bendravimą su sekėjais.',
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
                    className="text-left text-xs p-3 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 transition-all active:scale-[0.98]"
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
              className={`flex gap-3 max-w-3xl ${
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 text-white ${
                  msg.role === 'user'
                    ? 'bg-blue-600'
                    : 'bg-gradient-to-tr from-indigo-600 to-violet-600'
                }`}
              >
                {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
              </div>

              <div className="space-y-1 flex-1 min-w-0">
                <div
                  className={`rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm ml-auto'
                      : 'bg-gray-100 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 rounded-tl-sm border border-gray-200/60 dark:border-gray-700/60'
                  }`}
                >
                  {msg.content}
                </div>

                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 px-1">
                    {msg.model && <span>{msg.model.split('/').pop()}</span>}
                    <button
                      onClick={() => copyToClipboard(msg.content, idx)}
                      className="hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 transition-colors ml-auto"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <CheckCheck size={12} className="text-green-500" />
                          <span className="text-green-500">{t('ai.copied', 'Nukopijuota')}</span>
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
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shrink-0 text-white">
                <Bot size={15} />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800/90 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 border border-gray-200/60 dark:border-gray-700/60 text-gray-600 dark:text-gray-300">
                <Loader2 size={15} className="animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-xs">{t('ai.thinking', 'AI mąsto...')}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs">
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
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-3xl p-2 focus-within:border-blue-500 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('ai.input_placeholder', 'Parašykite žinutę AI asistentui...')}
              rows={1}
              className="flex-1 bg-transparent px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none outline-none max-h-32 min-h-[36px]"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all shrink-0 active:scale-95"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
          <div className="text-[11px] text-gray-400 text-center mt-1.5">
            {t('ai.shortcut_hint', 'Enter — siųsti · Shift+Enter — nauja eilutė')}
          </div>
        </div>
      </main>
    </div>
  )
}
