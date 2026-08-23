'use client'
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { translations, type Lang } from './translations'

export type { Lang }

interface I18nContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (
    key: string,
    paramsOrFallback?: Record<string, string | number> | string,
    maybeFallback?: string
  ) => string
  loaded: boolean
}

const DEFAULT_LANG: Lang = 'lt'
const SUPPORTED_LANGS: Lang[] = ['lt', 'en', 'ru', 'pl', 'uk']

const I18nContext = createContext<I18nContextType>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (k, fallback) => (typeof fallback === 'string' ? fallback : k),
  loaded: false,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)
  const [loaded, setLoaded] = useState(false)

  // Initialize lang on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lang') as Lang | null
      if (saved && SUPPORTED_LANGS.includes(saved)) {
        setLangState(saved)
        document.documentElement.lang = saved
      } else {
        // Check browser preference if available
        const navLang = navigator.language?.slice(0, 2) as Lang
        if (SUPPORTED_LANGS.includes(navLang)) {
          setLangState(navLang)
          document.documentElement.lang = navLang
        }
      }
    } catch {
      // Ignore storage errors in restricted iframe/private mode
    } finally {
      setLoaded(true)
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lang' && e.newValue && SUPPORTED_LANGS.includes(e.newValue as Lang)) {
        setLangState(e.newValue as Lang)
        document.documentElement.lang = e.newValue
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const setLang = useCallback((l: Lang) => {
    if (!SUPPORTED_LANGS.includes(l)) return
    setLangState(l)
    try {
      localStorage.setItem('lang', l)
      document.cookie = `lang=${l}; path=/; max-age=31536000; SameSite=Lax`
      document.documentElement.lang = l
    } catch {}
  }, [])

  const t = useCallback(
    (
      key: string,
      paramsOrFallback?: Record<string, string | number> | string,
      maybeFallback?: string
    ): string => {
      const isParamObj = typeof paramsOrFallback === 'object' && paramsOrFallback !== null
      const fallback = typeof paramsOrFallback === 'string' ? paramsOrFallback : maybeFallback

      let text =
        translations[lang]?.[key] ??
        translations[DEFAULT_LANG]?.[key] ??
        translations['en']?.[key] ??
        fallback ??
        key

      if (isParamObj) {
        Object.entries(paramsOrFallback).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        })
      }

      return text
    },
    [lang]
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t, loaded }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
