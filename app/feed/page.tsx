'use client'

import Image from 'next/image'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LoadingScreen from '@/app/components/LoadingScreen'
import IntroTour from '@/app/components/IntroTour'
import FeedHeader from '@/app/feed/components/FeedHeader'
import SearchFooter from '@/app/feed/components/SearchFooter'
import LoadingSpinner from '@/components/LoadingSpinner'
import ParticleCanvas from '@/components/ParticleCanvas'
import { getBoostedOutfits, saveSearchClick } from '@/lib/feedSearchMemory'
import { scoreOutfit } from '@/lib/feedMatching'
import { feedTranslations } from '@/data/translations'
import { useLocale } from '@/lib/locale-context'
import { searchOutfits } from '@/lib/searchOutfits'
import { useKeyboardOffset } from '@/hooks/useFeedUi'
import { useElephanteData } from '@/hooks/useElephanteData'
import { useFeedSearch } from '@/hooks/useFeedSearch'
import { useWardrobeAttachment } from '@/hooks/useWardrobeAttachment'
import { useRequireUser } from '@/hooks/useRequireUser'
import { canUseNextImage } from '@/lib/image'
import type { Outfit } from '@/types/outfit'

const EN = 'What shall we dress you for today?'
const AR = '\u0628\u0645\u0627\u0630\u0627 \u0646\u064f\u0644\u0628\u0633\u0643 \u0627\u0644\u064a\u0648\u0645\u061f'
const ARABIC_CHARS = '\u0627\u0628\u062a\u062b\u062c\u062d\u062e\u062f\u0630\u0631\u0632\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063a\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u0648\u064a'
const NL_SIGNALS = ['suggest', 'suggestion', 'recommend', 'recommendation', 'help', 'need', 'want', 'have', 'going', 'date', 'event', 'tonight', 'evening', 'morning', 'special', 'something', 'occasion', 'meeting', 'interview', 'wedding', 'party', 'dinner', 'casual', 'formal', 'office', 'work', 'business', 'weekend', 'summer', 'winter', 'night', 'out', 'smart', 'what', 'which', 'give', 'me', 'feel', 'look', 'wear', 'style', 'fit', 'outfit', 'dress', 'rate']
const POSSESSION_PREFIXES = ['i have', 'i own', "i've got", 'i got', "i'm wearing", 'wearing my', 'i wear']

function GlitchPlaceholder({ active }: { active: boolean }) {
  const { isAr } = useLocale()
  const [display, setDisplay] = useState(EN)
  const [glitching, setGlitching] = useState(false)
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // When device is Arabic, just show the Arabic placeholder statically
    if (isAr) {
      setDisplay(AR)
      return
    }

    if (active) return

    let cancelled = false
    const scrambleTo = (target: string, onDone: () => void) => {
      let frame = 0
      const totalFrames = 18

      const tick = () => {
        if (cancelled) return
        frame += 1
        const progress = frame / totalFrames
        const result = target.split('').map((char, index) => {
          if (char === ' ') return ' '
          if (index / target.length < progress) return char
          const pool = target === AR ? 'ABCDEFGHIJabcdefghij' : ARABIC_CHARS
          return pool[Math.floor(Math.random() * pool.length)] || char
        }).join('')

        setDisplay(result)
        if (frame < totalFrames) {
          frameRef.current = setTimeout(tick, 45)
        } else {
          setDisplay(target)
          setGlitching(false)
          // Check cancelled flag before calling onDone to ensure chain is fully severed on unmount
          if (!cancelled) onDone()
        }
      }

      tick()
    }

    const cycle = () => {
      if (cancelled) return

      frameRef.current = setTimeout(() => {
        if (cancelled) return
        setGlitching(true)
        scrambleTo(AR, () => {
          frameRef.current = setTimeout(() => {
            if (cancelled) return
            setGlitching(true)
            scrambleTo(EN, () => {
              if (!cancelled) {
                frameRef.current = setTimeout(cycle, 2800)
              }
            })
          }, 2000)
        })
      }, 2800)
    }

    setDisplay(EN)
    cycle()

    return () => {
      cancelled = true
      if (frameRef.current) clearTimeout(frameRef.current)
    }
  }, [active, isAr])

  if (active) return null

  const isArabic = isAr || display === AR || (glitching && display.split('').some((char) => ARABIC_CHARS.includes(char) && char !== ' '))

  return (
    <span
      className={`absolute z-10 top-1/2 -translate-y-1/2 pointer-events-none select-none text-zinc-500 text-base sm:text-sm truncate ${isAr ? 'right-6 left-14 text-right' : 'left-6 right-12 text-left'}`}
      style={{
        fontFamily: isArabic ? 'var(--font-arabic, serif)' : 'inherit',
        letterSpacing: glitching ? '0.02em' : 'normal',
        textShadow: glitching ? '0 0 8px rgba(255,255,255,0.15)' : 'none',
        transition: 'text-shadow 0.1s',
      }}
    >
      {display}
    </span>
  )
}

function TypewriterText({ text, speed = 18 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    if (!text) return

    let index = 0
    const timer = setInterval(() => {
      index += 1
      setDisplayed(text.slice(0, index))
      if (index >= text.length) {
        clearInterval(timer)
        setDone(true)
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed])

  return (
    <span>
      {displayed}
      {!done ? <span className="inline-block w-[2px] h-[1em] bg-zinc-400 align-middle ml-[1px] animate-pulse" /> : null}
    </span>
  )
}

function getOutfitGender(outfit: Outfit): 'male' | 'female' | 'unisex' {
  const aesthetic = (outfit.aesthetic || '').toLowerCase()
  const code = (outfit.outfit_code || '').toUpperCase()

  if (aesthetic.includes('female') || /^F(BC|F|SC)/.test(code)) return 'female'
  if (aesthetic.includes('male') || /^(TH|WS|WB|M(BC|F|SC))/.test(code)) return 'male'
  return 'unisex'
}

function isNaturalQuery(query: string) {
  const lower = query.trim().toLowerCase()
  if (!lower) return false
  if (POSSESSION_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true
  if (/[?!]/.test(lower)) return true
  const words = lower.split(/\s+/)
  if (words.length >= 2 && words.some((word) => NL_SIGNALS.includes(word))) return true
  if (words.length >= 4) return true
  return words.some((word) => NL_SIGNALS.includes(word))
}

function OutfitCardImage({ outfit, alt }: { outfit: Outfit; alt: string }) {
  if (!outfit.image_url) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-zinc-800 text-[9px] uppercase tracking-widest">No image</span>
      </div>
    )
  }

  if (canUseNextImage(outfit.image_url)) {
    return (
      <Image
        src={outfit.image_url}
        alt={alt}
        fill
        unoptimized
        sizes="(max-width: 768px) 50vw, 33vw"
        className="w-full h-full object-cover object-top opacity-75 group-hover:opacity-100 transition-opacity duration-400"
      />
    )
  }

  return (
    <img
      src={outfit.image_url}
      alt={alt}
      className="w-full h-full object-cover object-top opacity-75 group-hover:opacity-100 transition-opacity duration-400"
      loading="lazy"
    />
  )
}

function GeneratedOutfitImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className: string
}) {
  if (canUseNextImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes="(max-width: 768px) 50vw, 33vw"
        className={className}
      />
    )
  }

  return <img src={src} alt={alt} className={className} loading="lazy" />
}

function FeedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading: authLoading } = useRequireUser('/login')
  const initialQuery = searchParams?.get('q') || ''
  const replaceUrl = useCallback((url: string) => {
    router.replace(url, { scroll: false })
  }, [router])

  const kbOffset = useKeyboardOffset()

  // Chat display state
  const [pendingUserMessage, setPendingUserMessage] = useState('')
  const [chipDisplayMap, setChipDisplayMap] = useState<Record<string, string>>({})
  const prevHistoryLenRef = useRef(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const {
    allOutfits,
    allOutfitsRef,
    displayName,
    loading,
    showTour,
    userBodyShape,
    userGender,
    userHeight,
    userId,
    userPalettes,
    userSkinTone,
    userStylePref,
    setShowTour,
  } = useElephanteData(() => router.push('/login'))

  const {
    aiContext,
    buildFollowUpPrompt,
    chatHistory,
    clearActiveSearchState,
    curateTriggered,
    finalBanner,
    generatedOutfit,
    generatingOutfit,
    handleGeneratedTap,
    inputValue,
    isSearching,
    isThinking,
    saveFeedState,
    searchQuery,
    setInputValue,
    setSearchQuery,
    triggerCuration,
  } = useFeedSearch({
    allOutfits,
    allOutfitsRef,
    displayName,
    getOutfitGender,
    initialQuery,
    isNaturalQuery,
    onNavigateToLogin: () => router.push('/login'),
    onNavigateToOutfit: (id) => router.push(`/outfit/${id}`),
    replaceUrl,
    searchParams,
    userBodyShape,
    userGender,
    userHeight,
    userSkinTone,
    userStylePref,
  })

  const {
    attachment,
    clearAttachment,
    confirmAttachment,
    fileInputRef,
    handleAttachment,
    updateTag,
  } = useWardrobeAttachment(
    userId,
    (query) => {
      setInputValue(query)
      setSearchQuery(query)
    },
    () => {
      setInputValue('')
      setSearchQuery('')
      clearActiveSearchState()
    }
  )

  // Clear pending message when chatHistory grows (AI responded)
  useEffect(() => {
    if (chatHistory.length > prevHistoryLenRef.current) {
      setPendingUserMessage('')
    }
    if (chatHistory.length === 0) {
      setChipDisplayMap({})
    }
    prevHistoryLenRef.current = chatHistory.length
  }, [chatHistory.length])

  // Auto-scroll to latest message
  useEffect(() => {
    if (pendingUserMessage || isThinking || chatHistory.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [chatHistory.length, isThinking, pendingUserMessage, finalBanner])

  // Chip tap: show chip label in chat, send full prompt to AI
  const handleChipTap = useCallback((chip: string) => {
    const prompt = buildFollowUpPrompt(chip)
    setChipDisplayMap((previous) => ({ ...previous, [prompt]: chip }))
    setPendingUserMessage(chip)
    setInputValue('')
    setSearchQuery(prompt)
  }, [buildFollowUpPrompt, setInputValue, setSearchQuery])

  const boostedIds = aiContext?.intent ? getBoostedOutfits(aiContext.intent) : []

  const genderFiltered = useMemo(() => {
    return allOutfits.filter((item) => {
      const outfitGender = getOutfitGender(item)
      return outfitGender === 'unisex' || outfitGender === userGender
    })
  }, [allOutfits, userGender])

  const sortedFeed = useMemo(() => {
    return [...genderFiltered].sort(
      (a, b) => scoreOutfit(b, userSkinTone, userPalettes, userBodyShape) - scoreOutfit(a, userSkinTone, userPalettes, userBodyShape)
    )
  }, [genderFiltered, userSkinTone, userPalettes, userBodyShape])

  const filteredOutfits: Outfit[] = useMemo(() => {
    if (!searchQuery) return sortedFeed
    if (aiContext?.suggestions?.length) {
      return aiContext.suggestions
        .map((suggestion) => genderFiltered.find((outfit) => String(outfit.id) === String(suggestion.outfit_id)))
        .filter((outfit): outfit is Outfit => Boolean(outfit))
    }
    if (aiContext) return []
    return searchOutfits(genderFiltered, searchQuery).sort((a, b) => {
      const aScore = (boostedIds.includes(String(a.id)) ? 10 : 0) + scoreOutfit(a, userSkinTone, userPalettes, userBodyShape)
      const bScore = (boostedIds.includes(String(b.id)) ? 10 : 0) + scoreOutfit(b, userSkinTone, userPalettes, userBodyShape)
      return bScore - aScore
    })
  }, [searchQuery, aiContext, sortedFeed, genderFiltered, boostedIds, userSkinTone, userPalettes, userBodyShape])

  if (loading || authLoading) return <LoadingScreen />

  return (
    <div className="bg-black text-white font-sans selection:bg-zinc-800" style={{ height: '100dvh' }}>
      {showTour ? <IntroTour onDone={() => setShowTour(false)} /> : null}

      <ParticleCanvas desktopCount={36} mobileCount={24} />

      <FeedHeader
        displayName={displayName}
        isSearching={isSearching}
        onGoHome={() => {
          setInputValue('')
          setSearchQuery('')
          setPendingUserMessage('')
          setChipDisplayMap({})
          clearActiveSearchState()
        }}
        onOpenAiStylist={() => router.push('/ai-stylist')}
        onOpenCloset={() => router.push('/closet')}
        onOpenProfile={() => router.push('/profile')}
      />

      <div
        className="fixed left-0 right-0 z-20 overflow-y-auto overscroll-contain"
        style={{
          top: 0,
          bottom: 0,
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {isSearching ? (
          <div className="px-4 sm:px-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ paddingTop: 'calc(max(2rem, env(safe-area-inset-top)) + 60px)' }}>

            {/* ── Chat thread ── */}
            <div className="flex flex-col gap-2.5 mb-4">
              {chatHistory.map((turn, index) => {
                const isLatestAssistant = turn.role === 'assistant' && index === chatHistory.length - 1 && Boolean(finalBanner)
                const displayText = turn.role === 'user'
                  ? (chipDisplayMap[turn.content] ?? turn.content)
                  : turn.content
                const isFaded = index < chatHistory.length - 2

                return (
                  <div
                    key={index}
                    className={`flex items-end gap-2 transition-opacity duration-300 ${turn.role === 'user' ? 'justify-end' : 'justify-start'} ${isFaded ? 'opacity-45' : 'opacity-100'}`}
                  >
                    {turn.role === 'assistant' && (
                      <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 mb-0.5">
                        <img src="/logo.png" alt="" className="w-9 h-9 object-contain" style={{ filter: 'invert(1)', opacity: 1 }} aria-hidden="true" />
                      </div>
                    )}
                    <div className={`max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed ${
                      turn.role === 'user'
                        ? 'bg-zinc-800 text-white rounded-2xl rounded-br-sm'
                        : 'bg-zinc-900/80 border border-zinc-800/60 text-zinc-200 rounded-2xl rounded-bl-sm'
                    }`}>
                      {isLatestAssistant ? (
                        <TypewriterText key={displayText} text={displayText} speed={14} />
                      ) : displayText}
                    </div>
                  </div>
                )
              })}

              {/* Colour palette under the latest assistant bubble */}
              {!isThinking && finalBanner?.colors?.length ? (
                <div className="ml-8 animate-in fade-in duration-500" style={{ animationDelay: '700ms', animationFillMode: 'both' }}>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 mb-2">Your colour palette</p>
                  <div className="flex flex-wrap gap-2">
                    {finalBanner.colors.map((color) => (
                      <div key={`${color.hex}-${color.name}`} className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full border border-zinc-800/80" style={{ backgroundColor: color.hex }} title={color.name} />
                        <span className="text-[8px] text-zinc-600 text-center leading-tight max-w-[36px] truncate">{color.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Clarification chips — shown as quick-reply options */}
              {!isThinking && aiContext?.needs_clarification ? (
                <div className="ml-8 flex flex-wrap gap-2 animate-in fade-in duration-500" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
                  {['Smart Casual', 'Formal / Work', 'Weekend Casual', 'Night Out', 'Summer Look'].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleChipTap(chip)}
                      className="px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-300 text-[11px] hover:border-white hover:text-white hover:bg-zinc-900/60 transition-all duration-200 active:scale-95"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Follow-up chips after a successful response */}
              {!isThinking && !aiContext?.needs_clarification && chatHistory.length >= 2 && finalBanner && !generatingOutfit ? (
                <div className="ml-8 flex flex-wrap gap-2 animate-in fade-in duration-500" style={{ animationDelay: '1000ms', animationFillMode: 'both' }}>
                  {['More formal', 'More casual', 'Different colours', 'Summer version', 'Night out version'].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleChipTap(chip)}
                      className="px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-500 text-[11px] hover:border-zinc-600 hover:text-zinc-300 transition-all duration-200 active:scale-95"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Advice mode curate button */}
              {!isThinking && aiContext?.mode === 'advice' && !generatingOutfit && !generatedOutfit ? (
                <div className="ml-8 animate-in fade-in duration-700" style={{ animationDelay: '1200ms', animationFillMode: 'both' }}>
                  {!curateTriggered ? (
                    <button
                      onClick={triggerCuration}
                      className="px-5 py-2.5 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all duration-300 active:scale-95"
                    >
                      Yes, curate for me →
                    </button>
                  ) : (
                    <p className="text-zinc-600 text-[10px] uppercase tracking-widest animate-pulse">Building your look...</p>
                  )}
                </div>
              ) : null}

              {/* Pending user bubble (chip tap or typed query — shown while AI thinks) */}
              {pendingUserMessage ? (
                <div className="flex justify-end">
                  <div className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-zinc-800 text-white text-[13px] leading-relaxed">
                    {pendingUserMessage}
                  </div>
                </div>
              ) : null}

              {/* Typing indicator */}
              {isThinking ? (
                <div className="flex items-end gap-2">
                  <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                    <img src="/logo.png" alt="" className="w-9 h-9 object-contain" style={{ filter: 'invert(1)', opacity: 1 }} aria-hidden="true" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-zinc-900/80 border border-zinc-800/60">
                    <div className="flex gap-[5px] items-center" aria-label="Elephante is thinking">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/35 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={chatEndRef} />
            </div>

            {/* ── Outfit results ── */}
            {aiContext?.mode !== 'advice' || generatingOutfit || generatedOutfit ? (
              <>
                {!isThinking && (filteredOutfits.length > 0 || generatingOutfit || generatedOutfit) ? (
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px bg-zinc-900 flex-1" />
                    <span className="text-zinc-700 text-[9px] uppercase tracking-widest">
                      {generatingOutfit ? 'Creating your look...' : `${filteredOutfits.length} outfit${filteredOutfits.length !== 1 ? 's' : ''}`}
                    </span>
                    <div className="h-px bg-zinc-900 flex-1" />
                  </div>
                ) : null}

                {!isThinking && aiContext?.mode !== 'advice' && filteredOutfits.length === 0 && !generatingOutfit && !generatedOutfit ? (
                  <p className="text-zinc-700 text-[11px] text-center py-8 leading-relaxed">
                    {searchQuery ? feedTranslations.en.emptySearch : feedTranslations.en.emptyFeed}
                  </p>
                ) : null}

                <div className="grid grid-cols-2 gap-y-5 sm:gap-y-6 gap-x-3 sm:gap-x-4">
                  {((filteredOutfits.length === 0 && generatingOutfit && aiContext?.mode !== 'advice') || (curateTriggered && generatingOutfit)) ? (
                    <>
                      {[0, 1].map((value) => (
                        <div key={value} className="group">
                          <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl sm:rounded-2xl skeleton" />
                          <div className="mt-2 h-2 rounded-full skeleton w-2/3" />
                        </div>
                      ))}
                    </>
                  ) : null}

                  {filteredOutfits.length === 0 && !generatingOutfit && generatedOutfit ? (
                    <>
                      <div className="group cursor-pointer" style={{ opacity: 0, animation: 'cardIn 0.45s ease forwards', animationDelay: '0ms' }} onClick={() => handleGeneratedTap('primary')}>
                        <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-900 transition-transform duration-300 group-hover:scale-[1.02] group-active:scale-[0.98]">
                          {generatedOutfit.image_url ? (
                            <GeneratedOutfitImage src={generatedOutfit.image_url} alt={generatedOutfit.outfit?.outfit_name || 'Generated outfit'} className="w-full h-full object-cover object-top opacity-75 group-hover:opacity-100 transition-opacity duration-400" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><span className="text-zinc-800 text-[9px] uppercase tracking-widest">No image</span></div>
                          )}
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[8px] uppercase tracking-widest text-zinc-400 border border-zinc-800/60">AI</span>
                        </div>
                        {generatedOutfit.outfit?.style || generatedOutfit.outfit?.outfit_name ? (
                          <p className="mt-1.5 text-[9px] uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 truncate px-0.5 transition-colors duration-200">
                            {generatedOutfit.outfit?.style || generatedOutfit.outfit?.outfit_name}
                          </p>
                        ) : null}
                      </div>

                      {generatedOutfit.outfit?.alternative ? (
                        <div className="group cursor-pointer" style={{ opacity: 0, animation: 'cardIn 0.45s ease forwards', animationDelay: '80ms' }} onClick={() => handleGeneratedTap('alternative')}>
                          <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-900 transition-transform duration-300 group-hover:scale-[1.02] group-active:scale-[0.98]">
                            {generatedOutfit.alternative_image_url ? (
                              <GeneratedOutfitImage src={generatedOutfit.alternative_image_url} alt={generatedOutfit.outfit.alternative?.outfit_name || 'Suggested outfit'} className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity duration-400" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><span className="text-zinc-800 text-[9px] uppercase tracking-widest">No image</span></div>
                            )}
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[8px] uppercase tracking-widest text-zinc-400 border border-zinc-800/60">Alt</span>
                          </div>
                          {generatedOutfit.outfit.alternative?.style || generatedOutfit.outfit.alternative?.outfit_name ? (
                            <p className="mt-1.5 text-[9px] uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 truncate px-0.5 transition-colors duration-200">
                              {generatedOutfit.outfit.alternative?.style || generatedOutfit.outfit.alternative?.outfit_name}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {filteredOutfits.map((outfit, index) => {
                    const isBoosted = boostedIds.includes(String(outfit.id))
                    const aiReason = aiContext?.suggestions?.find((suggestion) => String(suggestion.outfit_id) === String(outfit.id))?.reason
                    const tag = outfit.style || outfit.aesthetic?.replace(/^(male|female)\s+/i, '') || 'Outfit'

                    return (
                      <div
                        key={`${outfit.id}-${index}`}
                        className="group cursor-pointer"
                        style={{ opacity: 0, animation: 'cardIn 0.45s ease forwards', animationDelay: `${Math.min(index * 40, 400)}ms` }}
                        onClick={() => {
                          if (aiContext?.intent) saveSearchClick(aiContext.intent, [], String(outfit.id))
                          saveFeedState()
                          router.push(`/outfit/${outfit.id}`)
                        }}
                      >
                        <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-900 transition-transform duration-300 group-hover:scale-[1.02] group-active:scale-[0.97]">
                          <OutfitCardImage outfit={outfit} alt={tag} />
                          {isBoosted ? (
                            <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                          ) : null}
                        </div>
                        {aiReason ? (
                          <p className="mt-1.5 text-[10px] text-zinc-500 group-hover:text-zinc-400 leading-snug px-0.5 line-clamp-2 transition-colors duration-200">{aiReason}</p>
                        ) : (
                          <p className="mt-1.5 text-[9px] uppercase tracking-[0.2em] text-zinc-700 group-hover:text-zinc-500 truncate px-0.5 transition-colors duration-200">{tag}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <SearchFooter
        attachment={attachment}
        clearAttachment={clearAttachment}
        confirmAttachment={confirmAttachment}
        fileInputRef={fileInputRef}
        handleAttachment={handleAttachment}
        inputValue={inputValue}
        isThinking={isThinking}
        keyboardOffset={kbOffset}
        onInputChange={(value) => {
          setInputValue(value)
          if (value === '') {
            setSearchQuery('')
            setPendingUserMessage('')
            setChipDisplayMap({})
            clearActiveSearchState()
          }
        }}
        onSubmit={() => {
          const q = inputValue.trim()
          if (!q) return
          setPendingUserMessage(q)
          setSearchQuery(q)
          setInputValue('')
        }}
        onTagChange={updateTag}
        placeholderOverlay={<GlitchPlaceholder active={inputValue.length > 0} />}
      />
    </div>
  )
}

export default function Feed() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><LoadingSpinner text="Loading Feed..." /></div>}>
      <FeedContent />
    </Suspense>
  )
}
