'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
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

interface AIChatDrawerProps {
  isOpen: boolean
  onClose: () => void
  launcherRef?: React.RefObject<HTMLButtonElement | null>
}

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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const suggestions = [
    t('ai.promptIdea', 'Sugalvok įrašo idėją'),
    t('ai.promptService', 'Padėk parašyti paslaugos aprašymą'),
    t('ai.promptContent', 'Surask aktualų turinį MiniSocial'),
    t('ai.promptReply', 'Padėk atsakyti klientui'),
  ]

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
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
        setError(t('ai.unavailable', 'Nepavyko užkrauti pokalbio.'))
        setMessages([])
      }
    } catch {
      setError(t('ai.unavailable', 'Tinklo klaida kraunant pokalbį.'))
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
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMsg =
          data?.error === 'AI_RATE_LIMITED'
            ? t('ai.rateLimited', 'Per daug užklausų. Bandykite šiek tiek vėliau.')
            : data?.error === 'AI_UNAVAILABLE'
              ? t('ai.unavailable', 'MiniSocial AI šiuo metu nepasiekiamas. Pabandykite dar kartą po kelių akimirkų.')
              : data?.message || t('ai.unavailable', 'MiniSocial AI šiuo metu nepasiekiamas. Pabandykite dar kartą.')
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
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setError(t('ai.unavailable', 'MiniSocial AI šiuo metu nepasiekiamas. Pabandykite dar kartą po kelių akimirkų.'))
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
        aria-label={t('ai.assistantTitle', 'MiniSocial AI')}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-full sm:max-w-[460px] md:max-w-[490px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-gray-900 border-l border-slate-200/80 dark:border-gray-800 animate-in slide-in-from-right duration-250"
      >
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-100 px-4 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {showHistory ? (
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                aria-label={t('ai.back', 'Atgal į pokalbį')}
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white shadow-md shadow-violet-500/25">
                <Sparkles size={18} />
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                {showHistory ? t('ai.history', 'Pokalbių istorija') : t('ai.assistantTitle', 'MiniSocial AI')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-tight">
                {showHistory
                  ? t('ai.history', 'Pokalbių istorija')
                  : activeThreadId
                    ? t('ai.activeChat', 'Aktyvus pokalbis')
                    : t('ai.assistantSubtitle', 'Jūsų asmeninis MiniSocial asistentas')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!showHistory && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  title={t('ai.history', 'Pokalbių istorija')}
                  aria-label={t('ai.history', 'Pokalbių istorija')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
                >
                  <MessageSquare size={17} />
                </button>
                <button
                  type="button"
                  onClick={startNewChat}
                  title={t('ai.newChat', 'Naujas pokalbis')}
                  aria-label={t('ai.newChat', 'Naujas pokalbis')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
                >
                  <Plus size={18} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              title={t('ai.close', 'Uždaryti')}
              aria-label={t('ai.close', 'Uždaryti')}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors ml-0.5"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* History View or Messages Stream */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <button
              type="button"
              onClick={startNewChat}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 dark:border-violet-800 p-3.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50/70 dark:hover:bg-violet-950/40 transition-colors shadow-sm"
            >
              <Plus size={16} />
              {t('ai.startNewChat', 'Pradėti naują pokalbį')}
            </button>

            {loadingThreads ? (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 dark:text-gray-500">
                {t('ai.noHistory', 'Dar nėra išsaugotų pokalbių.')}
              </div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => void selectThread(thread.id)}
                  className={`group flex items-center justify-between gap-2 rounded-2xl p-3.5 text-xs cursor-pointer border transition-all ${
                    thread.id === activeThreadId
                      ? 'border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200 shadow-sm'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/80 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-800/60 text-slate-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare size={15} className="flex-shrink-0 text-slate-400" />
                    <span className="truncate font-medium">{thread.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => void deleteThread(e, thread.id)}
                    aria-label={`${t('ai.delete', 'Ištrinti')} ${thread.title}`}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
                {/* Centered Glowing Icon */}
                <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white shadow-xl shadow-violet-500/25">
                  <Sparkles size={28} />
                  <span className="absolute inset-0 rounded-3xl bg-violet-400 opacity-20 animate-pulse" />
                </div>

                <div className="max-w-xs space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('ai.welcomeTitle', 'Kuo galiu padėti?')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                    {t('ai.welcomeSubtitle', 'Galiu padėti su MiniSocial, turiniu, paslaugomis, paieška ir kasdienėmis užduotimis.')}
                  </p>
                </div>

                {/* Suggestion Cards */}
                <div className="w-full max-w-sm space-y-2 pt-1">
                  {suggestions.map((promptText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void handleSendMessage(promptText)}
                      className="w-full rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3 text-left text-xs font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-900 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300 dark:hover:border-violet-700 dark:hover:bg-violet-950/30 dark:hover:text-violet-200 transition-all shadow-sm"
                    >
                      {promptText}
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
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                        <Sparkles size={12} className="text-violet-500" />
                        <span>MiniSocial AI</span>
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] px-4 py-3 text-xs leading-relaxed ${
                        isUser
                          ? 'rounded-2xl rounded-tr-sm bg-[#1A1A2E] text-white dark:bg-blue-600 shadow-sm'
                          : 'rounded-2xl rounded-tl-sm bg-slate-100/90 text-slate-800 dark:bg-gray-800/90 dark:text-gray-100 border border-slate-200/60 dark:border-gray-700/60 shadow-sm'
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
                              .trim() || t('ai.unavailable', 'Atsiprašome, įvyko klaida.')}
                      </p>
                    </div>

                    {!isUser && (
                      <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400 dark:text-gray-500">
                        <button
                          type="button"
                          onClick={() => copyMessage(msg.content, index)}
                          className="hover:text-slate-700 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
                        >
                          {copiedIndex === index ? (
                            <>
                              <CheckCheck size={11} className="text-emerald-500" /> {t('ai.copied', 'Nukopijuota')}
                            </>
                          ) : (
                            <>
                              <Copy size={11} /> {t('ai.copy', 'Kopijuoti')}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 py-2.5 px-2 animate-pulse">
                <Loader2 size={15} className="animate-spin text-violet-600 dark:text-violet-400" />
                <span>{t('ai.thinking', 'AI galvoja...')}</span>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50/80 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 flex items-center justify-between gap-2 shadow-sm">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  className="flex items-center gap-1 font-semibold text-red-800 dark:text-red-200 hover:underline flex-shrink-0"
                >
                  <RotateCcw size={12} /> {t('ai.retry', 'Bandyti dar kartą')}
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Bottom Input Area */}
        {!showHistory && (
          <footer className="border-t border-slate-100 p-3.5 pb-[calc(0.85rem+env(safe-area-inset-bottom))] dark:border-gray-800/80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md">
            <div className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 focus-within:border-violet-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-800/70 dark:focus-within:border-violet-500 dark:focus-within:bg-gray-800 transition-all shadow-sm">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('ai.inputPlaceholder', 'Paklauskite MiniSocial AI...')}
                rows={1}
                disabled={loading}
                className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none dark:text-gray-100 dark:placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!input.trim() || loading}
                aria-label={t('ai.send', 'Siųsti žinutę')}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white shadow-sm hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0 mb-0.5"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
              </button>
            </div>
            <div className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-gray-500">
              {t('ai.inputHint', 'Shift + Enter naujai eilutei • Enter siuntimui')}
            </div>
          </footer>
        )}
      </div>
    </>
  )
}
