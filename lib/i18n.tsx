'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Lang = 'lt' | 'en' | 'ru' | 'pl' | 'uk'

interface I18nContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  loaded: boolean
}

const DEFAULT_LANG: Lang = 'lt'

const I18nContext = createContext<I18nContextType>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (k) => k,
  loaded: false,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  // Load common locale JSON
  useEffect(() => {
    let cancelled = false
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('lang') as Lang | null) : null
    const initialLang = saved && ['lt', 'en', 'ru', 'pl', 'uk'].includes(saved) ? saved : DEFAULT_LANG
    setLangState(initialLang)

    fetch('/locales.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, Record<string, string>>) => {
        if (!cancelled) {
          setTranslations(data[initialLang] || data[DEFAULT_LANG] || {})
          setLoaded(true)
        }
      })
      .catch(() => setLoaded(true))

    return () => { cancelled = true }
  }, [])

  // Reload translations when language changes
  useEffect(() => {
    let cancelled = false
    fetch('/locales.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, Record<string, string>>) => {
        if (!cancelled) {
          setTranslations(data[lang] || data[DEFAULT_LANG] || {})
          setLoaded(true)
        }
      })
      .catch(() => setLoaded(true))
    return () => { cancelled = true }
  }, [lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    if (typeof window !== 'undefined') {
      localStorage.setItem('lang', l)
    }
  }

  const t = (key: string) => translations[key] || key

  return <I18nContext.Provider value={{ lang, setLang, t, loaded }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
