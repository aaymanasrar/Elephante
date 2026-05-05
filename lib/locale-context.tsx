'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Lang = 'en' | 'ar'

interface LocaleValue {
  lang: Lang
  isAr: boolean
  setLang: (lang: Lang) => void
}

const LocaleContext = createContext<LocaleValue>({ lang: 'en', isAr: false, setLang: () => {} })

const STORAGE_KEY = 'elephante_lang'

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'ar' || stored === 'en') setLang(stored)
  }, [])

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  const updateLang = (nextLang: Lang) => {
    setLang(nextLang)
    localStorage.setItem(STORAGE_KEY, nextLang)
  }

  return (
    <LocaleContext.Provider value={{ lang, isAr: lang === 'ar', setLang: updateLang }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
