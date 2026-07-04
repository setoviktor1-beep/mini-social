'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  resolvedTheme: 'light',
})

export function useTheme() {
  return useContext(ThemeContext)
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// CB1: Listen for browser back/forward navigation and refresh server data
function RouterRefreshListener() {
  const router = useRouter()
  useEffect(() => {
    const handlePopState = () => {
      router.refresh()
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [router])
  return null
}

// CB3: Restore Supabase session on page load and keep it alive
function SupabaseSessionRestorer() {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    // Trigger session restoration from cookies/storage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Session exists — ensure server components see the refreshed session
        router.refresh()
      }
    })
    // Listen for auth state changes and refresh server data accordingly
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        router.refresh()
      }
    })
    return () => subscription.unsubscribe()
  }, [router])
  return null
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored)
    } else {
      // Default to light theme
      setThemeState('light')
      localStorage.setItem('theme', 'light')
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const resolved = theme === 'system' ? getSystemTheme() : theme
    setResolvedTheme(resolved)
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme, mounted])

  useEffect(() => {
    if (!mounted) return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        const resolved = getSystemTheme()
        setResolvedTheme(resolved)
        if (resolved === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      <RouterRefreshListener />
      <SupabaseSessionRestorer />
      {children}
    </ThemeContext.Provider>
  )
}
