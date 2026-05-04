'use client'

import { useLocale } from '@/lib/locale-context'

interface FeedHeaderProps {
  displayName: string
  isSearching: boolean
  onGoHome: () => void
  onOpenAiStylist: () => void
  onOpenCloset: () => void
  onOpenProfile: () => void
}

export default function FeedHeader({
  displayName,
  isSearching,
  onGoHome,
  onOpenAiStylist,
  onOpenCloset,
  onOpenProfile,
}: FeedHeaderProps) {
  const { isAr } = useLocale()

  return (
    <>
      {/* Closet icon — top right (left in RTL) */}
      <button
        id="tour-closet"
        onClick={onOpenCloset}
        className="cursor-pointer fixed z-50 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 hover:text-white transition-colors duration-200 active:scale-90"
        style={{ top: 'max(2rem, env(safe-area-inset-top))', [isAr ? 'left' : 'right']: '1rem' }}
        aria-label="Open closet"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      </button>

      {/* Centred brand title + profile handle */}
      <div
        className="fixed z-40 flex flex-col items-center pointer-events-none"
        style={{
          left: '50%',
          top: isSearching ? 'calc(max(2rem, env(safe-area-inset-top)) + 22px)' : '50vh',
          transform: 'translateX(-50%) translateY(-50%)',
          transition: 'top 500ms cubic-bezier(0.4,0,0.2,1)',
          width: 'max-content',
        }}
      >
        <button
          id="tour-ai-stylist"
          onClick={isSearching ? onGoHome : onOpenAiStylist}
          className="cursor-pointer pointer-events-auto font-bold uppercase text-zinc-500 hover:text-white transition-all duration-300 active:scale-95"
          aria-label={isSearching ? 'Back to home feed' : 'Open AI Stylist'}
          style={{
            letterSpacing: isSearching ? '0.3em' : '0.4em',
            fontSize: isSearching ? '11px' : '15px',
            fontFamily: 'var(--font-display, inherit)',
            transition: 'font-size 500ms cubic-bezier(0.4,0,0.2,1), letter-spacing 500ms cubic-bezier(0.4,0,0.2,1), color 200ms',
          }}
        >
          Elephante AI
        </button>

        <button
          id="tour-profile"
          onClick={onOpenProfile}
          className="cursor-pointer group pointer-events-auto flex flex-col items-center mt-3 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
          style={{
            opacity: isSearching ? 0 : 1,
            transform: isSearching ? 'scale(0.95)' : 'scale(1)',
            pointerEvents: isSearching ? 'none' : 'auto',
          }}
          aria-label={`View profile for @${displayName}`}
        >
          <span className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-medium group-hover:text-zinc-200 transition-colors duration-200">
            @{displayName}
          </span>
          <div className="h-[1px] w-0 bg-white/50 group-hover:w-full transition-all duration-300" />
        </button>
      </div>
    </>
  )
}
