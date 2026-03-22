'use client'
import { useI18n } from '@/lib/i18n'

const LANGUAGES = [
  { code: 'lt', flag: '🇱🇹', label: 'LT' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'ru', flag: '🇷🇺', label: 'RU' },
  { code: 'pl', flag: '🇵🇱', label: 'PL' },
  { code: 'uk', flag: '🇺🇦', label: 'UA' },
] as const

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n()

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-full px-1 py-1">
      {LANGUAGES.map(({ code, flag, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          title={label}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all ${
            lang === code
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span>{flag}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
