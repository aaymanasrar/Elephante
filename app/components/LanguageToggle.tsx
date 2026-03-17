'use client'

import { useLanguage } from '@/app/contexts/LanguageContext'

export default function LanguageToggle() {
  const { lang, setLang, isAr } = useLanguage()

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className="fixed top-8 sm:top-10 left-4 sm:left-6 z-50 flex items-center gap-1.5 min-h-[44px] min-w-[44px] group"
      aria-label="Toggle language"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-zinc-600 group-hover:text-white transition-colors duration-300"
      >
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span
        className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 group-hover:text-white transition-colors duration-300"
        style={{ fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit' }}
      >
        {lang === 'en' ? 'EN' : 'AR'}
      </span>
    </button>
  )
}