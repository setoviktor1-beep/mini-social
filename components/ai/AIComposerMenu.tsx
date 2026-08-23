'use client'

import React, { useState, useRef, useEffect, useId } from 'react'
import {
  Sparkles,
  Wand2,
  CheckCheck,
  Smile,
  Globe2,
  Hash,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export type ComposerAiAction = 'rewrite' | 'spelling' | 'tone' | 'translate' | 'hashtags'

interface AIComposerMenuProps {
  onRunAction: (action: ComposerAiAction, extra?: { tone?: string; targetLanguage?: string }) => void
  disabled?: boolean
  loadingAction?: string | null
}

const TONES = [
  { id: 'draugišką', label: 'Draugiškas' },
  { id: 'formalų', label: 'Profesionalus' },
  { id: 'glaustą', label: 'Glaustas' },
  { id: 'entuziastingą', label: 'Entuziastingas' },
]

const LANGUAGES = [
  { id: 'anglų', label: 'English' },
  { id: 'lietuvių', label: 'Lietuvių' },
  { id: 'lenkų', label: 'Polski' },
  { id: 'rusų', label: 'Русский' },
  { id: 'ukrainiečių', label: 'Українська' },
  { id: 'vokiečių', label: 'Deutsch' },
]

export default function AIComposerMenu({
  onRunAction,
  disabled = false,
  loadingAction = null,
}: AIComposerMenuProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<'tone' | 'translate' | null>(null)
  const [selectedTone, setSelectedTone] = useState('draugišką')
  const [selectedLang, setSelectedLang] = useState('anglų')

  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (activeSubmenu) {
          setActiveSubmenu(null)
        } else {
          setIsOpen(false)
          buttonRef.current?.focus()
        }
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setActiveSubmenu(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, activeSubmenu])

  function triggerAction(action: ComposerAiAction, extra?: { tone?: string; targetLanguage?: string }) {
    setIsOpen(false)
    setActiveSubmenu(null)
    onRunAction(action, extra)
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        data-testid="composer-ai-menu"
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev)
            setActiveSubmenu(null)
          }
        }}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label="Composer AI įrankiai"
        title={disabled ? t('composer.aiDisabledPrompt', 'Įveskite tekstą, kad naudotumėte AI') : t('composer.aiTools', 'AI asistentas')}
        className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
          isOpen
            ? 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/40 dark:text-violet-200 dark:border-violet-700 shadow-sm'
            : 'border-violet-200/80 bg-violet-50/50 text-violet-700 hover:bg-violet-100/80 hover:text-violet-900 hover:border-violet-300 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-900/30'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {loadingAction ? (
          <Loader2 size={14} className="animate-spin text-violet-600 dark:text-violet-400" />
        ) : (
          <Sparkles size={14} className="text-violet-600 dark:text-violet-400" />
        )}
        <span>✨ AI</span>
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-violet-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-violet-900/50 dark:bg-gray-900/95 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            <span>{t('composer.aiTools', 'AI pagalbininkas')}</span>
            {activeSubmenu && (
              <button
                type="button"
                onClick={() => setActiveSubmenu(null)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 flex items-center gap-0.5"
              >
                <X size={12} /> Atgal
              </button>
            )}
          </div>

          {!activeSubmenu ? (
            <div className="flex flex-col gap-0.5">
              {/* Pagerinti tekstą */}
              <button
                type="button"
                onClick={() => triggerAction('rewrite')}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-200 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100/80 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                    <Wand2 size={15} />
                  </span>
                  <span>{t('composer.aiRewrite', 'Pagerinti tekstą')}</span>
                </div>
              </button>

              {/* Taisyti klaidas */}
              <button
                type="button"
                onClick={() => triggerAction('spelling')}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-200 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCheck size={15} />
                  </span>
                  <span>{t('composer.aiSpelling', 'Taisyti klaidas')}</span>
                </div>
              </button>

              {/* Pakeisti toną */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('tone')}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-200 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                    <Smile size={15} />
                  </span>
                  <span>{t('composer.aiTone', 'Pakeisti toną')}</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 dark:text-gray-500" />
              </button>

              {/* Versti */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('translate')}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-200 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/80 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                    <Globe2 size={15} />
                  </span>
                  <span>{t('composer.aiTranslate', 'Versti')}</span>
                </div>
                <ChevronRight size={14} className="text-slate-400 dark:text-gray-500" />
              </button>

              {/* Sugeneruoti žymas */}
              <button
                type="button"
                onClick={() => triggerAction('hashtags')}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-200 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-100/80 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300">
                    <Hash size={15} />
                  </span>
                  <span>{t('composer.aiHashtags', 'Sugeneruoti žymas')}</span>
                </div>
              </button>
            </div>
          ) : activeSubmenu === 'tone' ? (
            <div className="p-2 space-y-2">
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">
                Pasirinkite pageidaujamą toną:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTone(t.id)
                      triggerAction('tone', { tone: t.id })
                    }}
                    className={`rounded-xl px-2.5 py-2 text-xs font-medium text-center transition-all ${
                      selectedTone === t.id
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-700 hover:bg-violet-50 hover:text-violet-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">
                Pasirinkite tikslinę kalbą:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setSelectedLang(l.id)
                      triggerAction('translate', { targetLanguage: l.id })
                    }}
                    className={`rounded-xl px-2.5 py-2 text-xs font-medium text-center transition-all ${
                      selectedLang === l.id
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-700 hover:bg-violet-50 hover:text-violet-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
