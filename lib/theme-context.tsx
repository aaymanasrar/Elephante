'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePreference = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

interface ThemeValue {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  setThemePreference: (theme: ThemePreference) => void
}

const STORAGE_KEY = 'elephante_theme_preference'

const ThemeContext = createContext<ThemeValue>({
  themePreference: 'system',
  resolvedTheme: 'dark',
  setThemePreference: () => {},
})

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference)
  document.documentElement.dataset.themePreference = preference
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  return resolved
}

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark')

  useEffect(() => {
    const storedPreference = readStoredPreference()
    setThemePreferenceState(storedPreference)
    setResolvedTheme(applyTheme(storedPreference))
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const updateSystemTheme = () => {
      setResolvedTheme(applyTheme(readStoredPreference()))
    }

    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  const setThemePreference = (theme: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, theme)
    setThemePreferenceState(theme)
    setResolvedTheme(applyTheme(theme))
  }

  const value = useMemo(() => ({
    themePreference,
    resolvedTheme,
    setThemePreference,
  }), [themePreference, resolvedTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
