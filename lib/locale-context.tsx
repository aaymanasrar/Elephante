'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Lang = 'en' | 'ar'

interface LocaleValue {
  lang: Lang
  isAr: boolean
}

const LocaleContext = createContext<LocaleValue>({ lang: 'en', isAr: false })

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const detected = navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en'
    setLang(detected)
    document.documentElement.dir = detected === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = detected
  }, [])

  return (
    <LocaleContext.Provider value={{ lang, isAr: lang === 'ar' }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
