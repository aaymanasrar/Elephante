'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocale } from '@/lib/locale-context'
import Logo from '@/components/Logo'

interface ChatSession {
  id: string
  title: string
  timestamp: number
}

interface FeedHeaderProps {
  displayName: string
  isSearching: boolean
  onGoHome: () => void
  onOpenAiStylist: () => void
  onOpenCloset: () => void
  onOpenProfile: () => void
  onOpenOutfitBuilder?: () => void
  onOpenTravelPack?: () => void
  // History props
  chats: ChatSession[]
  activeChatId: string | null
  onLoadChat: (id: string) => void
  onDeleteChat: (id: string) => void
  onNewChat: () => void
}

export default function FeedHeader({
  displayName,
  isSearching,
  onGoHome,
  onOpenAiStylist,
  onOpenCloset,
  onOpenProfile,
  onOpenOutfitBuilder,
  onOpenTravelPack,
  chats,
  activeChatId,
  onLoadChat,
  onDeleteChat,
  onNewChat,
}: FeedHeaderProps) {
  const { isAr } = useLocale()
  const profileLabel = `@${displayName}`
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const menuContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setIsHistoryOpen(false)
      }
    }
    if (isHistoryOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isHistoryOpen])

  return (
    <div ref={menuContainerRef}>
      {/* Sidebar/History Toggle — top left (right in RTL) */}
      <button
        onClick={() => setIsHistoryOpen(prev => !prev)}
        className="cursor-pointer fixed z-50 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 hover:text-white transition-colors duration-200 active:scale-90"
        style={{ top: 'max(2rem, env(safe-area-inset-top))', [isAr ? 'right' : 'left']: '1rem' }}
        aria-label={isAr ? 'تاريخ المحادثات' : 'Chat History'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {/* History Dropdown transparent glass box */}
      {isHistoryOpen && (
        <div
          className="fixed z-50 w-72 rounded-2xl border border-zinc-800/80 bg-zinc-950/75 backdrop-blur-xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            top: 'calc(max(2rem, env(safe-area-inset-top)) + 52px)',
            [isAr ? 'right' : 'left']: '1rem',
            maxHeight: 'min(380px, 60vh)',
          }}
        >
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
              {isAr ? 'محادثاتك' : 'Conversations'}
            </span>
          </div>

          {/* New Chat Button */}
          <button
            onClick={() => {
              onNewChat()
              setIsHistoryOpen(false)
            }}
            className="w-full h-10 rounded-xl border border-dashed border-zinc-850 hover:border-zinc-500 text-[10px] uppercase tracking-widest text-center text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {isAr ? 'محادثة جديدة' : 'New Chat'}
          </button>

          {/* Chats list */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: 'none' }}>
            {chats.length === 0 ? (
              <p className="text-zinc-655 text-[11px] text-center py-6 italic">
                {isAr ? 'لا توجد محادثات سابقة' : 'No past conversations'}
              </p>
            ) : (
              chats.map((chat) => {
                const isActive = chat.id === activeChatId
                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      onLoadChat(chat.id)
                      setIsHistoryOpen(false)
                    }}
                    className={`group flex items-center justify-between gap-2 w-full rounded-xl p-2.5 cursor-pointer transition-all duration-205 ${
                      isActive
                        ? 'bg-white/10 border border-white/5 text-white'
                        : 'hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    <span className="flex-1 text-[12px] truncate leading-tight select-none pr-1">
                      {chat.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChat(chat.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-1 transition-all rounded-lg"
                      aria-label="Delete chat"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

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

      {/* Outfit Builder icon — top right next to closet */}
      {onOpenOutfitBuilder && (
        <button
          onClick={onOpenOutfitBuilder}
          className="cursor-pointer fixed z-50 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 hover:text-white transition-colors duration-200 active:scale-90"
          style={{ top: 'max(2rem, env(safe-area-inset-top))', [isAr ? 'left' : 'right']: '3.75rem' }}
          aria-label={isAr ? 'منشئ الإطلالة' : 'Outfit Builder'}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </button>
      )}

      {/* Travel Pack icon — top left (right in RTL) next to sidebar */}
      {onOpenTravelPack && (
        <button
          onClick={onOpenTravelPack}
          className="cursor-pointer fixed z-50 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 hover:text-white transition-colors duration-200 active:scale-90"
          style={{ top: 'max(2rem, env(safe-area-inset-top))', [isAr ? 'right' : 'left']: '3.75rem' }}
          aria-label={isAr ? 'حقيبة السفر' : 'Pack for a Trip'}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="8" width="22" height="13" rx="2" ry="2" />
            <path d="M16 8V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            <line x1="12" y1="13" x2="12" y2="17" />
            <line x1="10" y1="15" x2="14" y2="15" />
          </svg>
        </button>
      )}

      {/* Centred brand title + profile handle */}
      <div
        className="fixed z-40 flex flex-col items-center pointer-events-none"
        style={{
          left: '50%',
          top: isSearching ? 'max(2rem, env(safe-area-inset-top))' : '50vh',
          transform: isSearching ? 'translateX(-50%)' : 'translateX(-50%) translateY(-50%)',
          transition: 'top 500ms cubic-bezier(0.4,0,0.2,1), transform 500ms cubic-bezier(0.4,0,0.2,1)',
          width: isSearching ? '44px' : 'max-content',
          height: isSearching ? '44px' : 'auto',
        }}
      >
        <button
          id="tour-ai-stylist"
          onClick={isSearching ? onGoHome : onOpenAiStylist}
          className={`cursor-pointer pointer-events-auto flex items-center justify-center transition-all duration-300 active:scale-95 text-zinc-500 hover:text-white ${isSearching ? 'h-11 w-11' : ''}`}
          aria-label={isSearching ? 'Back to home feed' : 'Open AI Stylist'}
          style={{
            transform: 'scale(1)',
            transition: 'color 300ms',
          }}
        >
          <Logo size={isSearching ? 44 : 96} className="transition-all duration-500" />
        </button>

        <button
          id="tour-profile"
          onClick={onOpenProfile}
          className="cursor-pointer group pointer-events-auto flex flex-col items-center mt-2 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
          style={{
            opacity: isSearching ? 0 : 1,
            transform: isSearching ? 'scale(0.95)' : 'scale(1)',
            pointerEvents: isSearching ? 'none' : 'auto',
          }}
          aria-label={isAr ? `افتح حساب ${displayName}` : `View profile for @${displayName}`}
        >
          <span
            className={`text-zinc-500 text-[10px] font-medium group-hover:text-zinc-200 transition-colors duration-200 ${isAr ? 'tracking-normal' : 'uppercase tracking-[0.2em]'}`}
            dir="ltr"
            style={{ fontFamily: 'inherit', unicodeBidi: 'isolate' }}
          >
            {profileLabel}
          </span>
          <div className="h-[1px] w-0 bg-white/50 group-hover:w-full transition-all duration-300" />
        </button>
      </div>
    </div>
  )
}
