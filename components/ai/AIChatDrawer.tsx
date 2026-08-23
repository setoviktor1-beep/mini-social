'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
  Bot,
  User,
  Plus,
  Trash2,
  X,
  Loader2,
  Sparkles,
  MessageSquare,
  Copy,
  CheckCheck,
  RotateCcw,
  ChevronLeft,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { AVAILABLE_AI_MODELS, DEFAULT_AI_MODEL_ID } from '@/lib/ai/constants'

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

interface AIChatDrawerProps {
  isOpen: boolean
  onClose: () => void
  launcherRef?: React.RefObject<HTMLButtonElement | null>
}

const QUICK_PROMPTS = [
  'Pasiūlyk įrašo idėją meistrų bendruomenei',
  'Padėk suformuluoti naują paslaugos aprašymą',
  'Kaip patobulinti mano profilį ir pritraukti klientų?',
  'Parašyk trumpą, mandagų atsakymą klientui',
]

export default function AIChatDrawer({ isOpen, onClose, launcherRef }: AIChatDrawerProps) {
  const { t } = useI18n()
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_AI_MODEL_ID)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const fetchThreads = useCallback(async () => {
    try {
      setLoadingThreads(true)
      const res = await fetch('/api/ai/threads')
      if (res.ok) {
        const data = await res.json()
        setThreads(data.threads || [])
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingThreads(false)
    }
  }, [])

  // When drawer opens, load threads and focus textarea
  useEffect(() => {
    if (isOpen) {
      void fetchThreads()
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 150)
    } else {
      setShowHistory(false)
    }
  }, [isOpen, fetchThreads])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && !showHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, isOpen, showHistory])

  // Focus trap & Escape key
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (showHistory) {
          setShowHistory(false)
        } else {
          onClose()
          launcherRef?.current?.focus()
        }
        return
      }

      // Focus trap within drawer
      if (e.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showHistory, onClose, launcherRef])

  const selectThread = async (threadId: string) => {
    if (threadId === activeThreadId) {
      setShowHistory(false)
      return
    }

    setActiveThreadId(threadId)
    setShowHistory(false)
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/ai/threads/${threadId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      } else {
        setError('Nepavyko užkrauti pokalbio.')
        setMessages([])
      }
    } catch {
      setError('Tinklo klaida kraunant pokalbį.')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const startNewChat = () => {
    setActiveThreadId(null)
    setMessages([])
    setError(null)
    setInput('')
    setShowHistory(false)
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  const deleteThread = async (e: React.MouseEvent, threadId: string) => {
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
      // Non-fatal
    }
  }

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim()
    if (!messageText || loading) return

    setInput('')
    setError(null)

    // Optimistically add user message
    const tempUserMsg: Message = {
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          threadId: activeThreadId || undefined,
          model: selectedModel,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMsg =
          data?.error === 'AI_RATE_LIMITED'
            ? 'Per daug užklausų. Palaukite minutėlę.'
            : data?.error === 'AI_UNAVAILABLE'
              ? 'AI asistentas šiuo metu nepasiekiamas.'
              : data?.message || 'Atsiprašome, įvyko klaida.'
        setError(errorMsg)
        return
      }

      // Update active thread ID if new
      if (data.threadId && data.threadId !== activeThreadId) {
        setActiveThreadId(data.threadId)
        void fetchThreads()
      }

      // Append assistant message
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply,
        model: data.model,
        provider: data.provider,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setError('Nepavyko susisiekti su serveriu.')
    } finally {
      setLoading(false)
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendMessage()
    }
  }

  const copyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content).catch(() => {})
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Subtle backdrop on desktop / full backdrop on mobile */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer / Fullscreen on Mobile */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('ai.assistantTitle', 'AI Asistentas')}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-full sm:max-w-[460px] md:max-w-[490px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-gray-900 border-l border-slate-200/80 dark:border-gray-800 animate-in slide-in-from-right duration-250"
      >
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-slate-100 px-4 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            {showHistory ? (
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label="Atgal į pokalbį"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-sm shadow-violet-500/20">
                <Sparkles size={16} />
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                {showHistory ? 'Pokalbių istorija' : t('ai.assistantTitle', 'AI Asistentas')}
              </h2>
              {!showHistory && (
                <p className="text-[10px] text-slate-400 dark:text-gray-500 leading-tight">
                  {activeThreadId ? 'Aktyvus pokalbis' : 'Naujas pokalbis'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!showHistory && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  title="Pokalbių istorija"
                  aria-label="Pokalbių istorija"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                >
                  <MessageSquare size={16} />
                </button>
                <button
                  type="button"
                  onClick={startNewChat}
                  title="Naujas pokalbis"
                  aria-label="Naujas pokalbis"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus size={17} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Uždaryti"
              aria-label="Uždaryti AI asistentą"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* AI Model Selector Bar */}
        {!showHistory && (
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800/80 px-4 py-2 bg-slate-50/80 dark:bg-gray-900/50 text-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <Sparkles size={12} className="text-violet-500" />
              Modelis:
            </span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              aria-label="Pasirinkti AI modelį"
              className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-gray-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              {AVAILABLE_AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.badge})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* History View or Messages Stream */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <button
              type="button"
              onClick={startNewChat}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-violet-300 p-3 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/30 transition-colors"
            >
              <Plus size={16} />
              Pradėti naują pokalbį
            </button>

            {loadingThreads ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 dark:text-gray-500">
                Dar nėra išsaugotų pokalbių.
              </div>
            ) : (
              threads.map((t) => (
                <div
                  key={t.id}
                  onClick={() => void selectThread(t.id)}
                  className={`group flex items-center justify-between gap-2 rounded-2xl p-3 text-xs cursor-pointer border transition-all ${
                    t.id === activeThreadId
                      ? 'border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-800/50 text-slate-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare size={14} className="flex-shrink-0 text-slate-400" />
                    <span className="truncate font-medium">{t.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => void deleteThread(e, t.id)}
                    aria-label={`Ištrinti pokalbį ${t.title}`}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-lg shadow-violet-500/20">
                  <Sparkles size={24} />
                </div>
                <div className="max-w-xs space-y-1.5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Kuo galiu šiandien padėti?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Padėsiu kurti įrašus, planuoti paslaugas, analizuoti tendencijas ar atsakyti į klausimus.
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="w-full max-w-sm space-y-1.5 pt-2">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void handleSendMessage(prompt)}
                      className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 text-left text-xs text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300 dark:hover:border-violet-800 dark:hover:bg-violet-950/30 dark:hover:text-violet-200 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isUser = msg.role === 'user'
                return (
                  <div
                    key={index}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-[#1A1A2E] text-white dark:bg-blue-600 shadow-sm'
                          : 'bg-slate-100/90 text-slate-800 dark:bg-gray-800/90 dark:text-gray-100 border border-slate-200/60 dark:border-gray-700/60'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">
                        {isUser
                          ? msg.content
                          : msg.content
                              .replace(/`{3,}(?:tool_call|tool_code|function_call|tool)[\s\S]*?`{3,}/gi, '')
                              .replace(/`{3,}(?:json)?\s*\{\s*["'](?:tool|function|action)["']\s*:\s*["'][^"']+["'][\s\S]*?\}\s*`{3,}/gi, '')
                              .replace(/<(?:tool_call|tool_code|function_call|tool)>[\s\S]*?<\/(?:tool_call|tool_code|function_call|tool)>/gi, '')
                              .replace(/<\/?(?:tool_call|tool_code|function_call|tool)[^>]*>/gi, '')
                              .trim() || 'Atsiprašome, įvyko klaida.'}
                      </p>
                    </div>

                    {!isUser && (
                      <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400 dark:text-gray-500">
                        <button
                          type="button"
                          onClick={() => copyMessage(msg.content, index)}
                          className="hover:text-slate-700 dark:hover:text-gray-300 flex items-center gap-1"
                        >
                          {copiedIndex === index ? (
                            <>
                              <CheckCheck size={11} className="text-emerald-500" /> Nukopijuota
                            </>
                          ) : (
                            <>
                              <Copy size={11} /> Kopijuoti
                            </>
                          )}
                        </button>
                        {msg.model && (
                          <span>• {msg.model.split('/').pop()}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-gray-500 py-2">
                <Loader2 size={14} className="animate-spin text-violet-600 dark:text-violet-400" />
                <span>AI galvoja...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 flex items-center justify-between gap-2">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  className="flex items-center gap-1 font-semibold text-red-800 dark:text-red-200 hover:underline flex-shrink-0"
                >
                  <RotateCcw size={12} /> Kartoti
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Bottom Input */}
        {!showHistory && (
          <footer className="border-t border-slate-100 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-gray-800/80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md">
            <div className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5 focus-within:border-violet-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:focus-within:border-violet-500 dark:focus-within:bg-gray-800 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('ai.inputPlaceholder', 'Klauskite AI asistento...')}
                rows={1}
                disabled={loading}
                className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none dark:text-gray-100 dark:placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!input.trim() || loading}
                aria-label={t('ai.send', 'Siųsti žinutę')}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
              </button>
            </div>
            <div className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-gray-500">
              Shift + Enter naujai eilutei • Enter siuntimui
            </div>
          </footer>
        )}
      </div>
    </>
  )
}
