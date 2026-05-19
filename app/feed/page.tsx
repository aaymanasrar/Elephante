'use client'

import Image from 'next/image'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LoadingScreen from '@/app/components/LoadingScreen'
import IntroTour from '@/app/components/IntroTour'
import FeedHeader from '@/app/feed/components/FeedHeader'
import OutfitAnalysisCard from '@/app/feed/components/OutfitAnalysisCard'
import SearchFooter from '@/app/feed/components/SearchFooter'
import LoadingSpinner from '@/components/LoadingSpinner'
import ParticleCanvas from '@/components/ParticleCanvas'
import { getBoostedOutfits, saveSearchClick } from '@/lib/feedSearchMemory'
import { scoreOutfit } from '@/lib/feedMatching'
import { feedTranslations } from '@/data/translations'
import { useLocale } from '@/lib/locale-context'
import { searchOutfits } from '@/lib/searchOutfits'
import { useKeyboardOffset } from '@/hooks/useFeedUi'
import { writeLastFeedUrl } from '@/hooks/useFeedStatePersistence'
import { useElephanteData } from '@/hooks/useElephanteData'
import { useFeedSearch } from '@/hooks/useFeedSearch'
import { useWardrobeAttachment, type WardrobeAttachment } from '@/hooks/useWardrobeAttachment'
import { useRequireUser } from '@/hooks/useRequireUser'
import { useArabicTranslations } from '@/hooks/useArabicTranslations'
import { canUseNextImage } from '@/lib/image'
import type { Outfit } from '@/types/outfit'

const EN = 'What shall we dress you for today?'
const AR = '\u0628\u0645\u0627\u0630\u0627 \u0646\u064f\u0644\u0628\u0633\u0643 \u0627\u0644\u064a\u0648\u0645\u061f'
const NL_SIGNALS = ['suggest', 'suggestion', 'recommend', 'recommendation', 'help', 'need', 'want', 'have', 'going', 'date', 'event', 'tonight', 'evening', 'morning', 'special', 'something', 'occasion', 'meeting', 'interview', 'wedding', 'party', 'dinner', 'casual', 'formal', 'office', 'work', 'business', 'weekend', 'summer', 'winter', 'night', 'out', 'smart', 'what', 'which', 'give', 'me', 'feel', 'look', 'wear', 'style', 'fit', 'outfit', 'dress', 'rate']
const POSSESSION_PREFIXES = ['i have', 'i own', "i've got", 'i got', "i'm wearing", 'wearing my', 'i wear']

function SearchPlaceholder({ active, text }: { active: boolean; text?: string }) {
  const { isAr } = useLocale()

  if (active) return null

  return (
    <span
      className={`absolute z-10 top-1/2 -translate-y-1/2 pointer-events-none select-none text-zinc-500 text-base sm:text-sm truncate ${isAr ? 'right-6 left-14 text-right' : 'left-6 right-12 text-left'}`}
      style={{
        fontFamily: isAr ? 'var(--font-arabic, serif)' : 'inherit',
      }}
    >
      {text || (isAr ? AR : EN)}
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

function OutfitCardImage({ outfit, alt, noImageLabel }: { outfit: Outfit; alt: string; noImageLabel: string }) {
  if (!outfit.image_url) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-zinc-800 text-[9px] uppercase tracking-widest">{noImageLabel}</span>
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

type AttachmentAnalysis = {
  outfit_name?: string
  style?: string
  vibe?: string
  color_scheme?: string
  occasions?: string[]
  pieces?: string[]
  color_names?: string[]
  key_colors?: string[]
  rating_out_of_10?: number | null
  match_score?: number | null
  proportion_score?: number | null
  color_harmony_score?: number | null
  skin_tone_feedback?: string
  overall_verdict?: string
  why_it_works?: string
  styling_tip?: string
}

type FeedChatTurn = {
  role: 'user' | 'assistant'
  content: string
  display?: 'analysis-card'
  imagePreview?: string
}
type AttachmentAnalysisMode = 'inventory' | 'rating'
type AttachmentVisionMode = AttachmentAnalysisMode | 'question'

type AttachmentChatContext = {
  imageUrl: string
  imageLabel: string
  itemName: string
  itemType: string
  pieces: string[]
  color: string
  occasion: string
  details: string
}


function buildCurationQueryFromAttachment(
  attachment: WardrobeAttachment,
  isAr: boolean,
  mode: 'similar' | 'different' = 'similar',
): string {
  const parts = [
    attachment.item_name || attachment.item_type,
    attachment.color,
    ...(attachment.pieces || []).slice(0, 3),
  ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0 && !['none', 'null', 'n/a', 'na'].includes(p.trim().toLowerCase()))

  const desc = parts.join(', ')
  if (isAr) {
    return mode === 'similar'
      ? `اقترح لي إطلالات مشابهة: ${desc}`
      : `أعد تصميم هذه الإطلالة بأسلوب مختلف: ${desc}`
  }
  return mode === 'similar'
    ? `suggest similar outfits: ${desc}`
    : `restyle this with a fresh take: ${desc}`
}

function buildCurationQueryFromAnalysis(
  analysis: AttachmentAnalysis,
  isAr: boolean,
  mode: 'similar' | 'different' = 'similar',
): string {
  const parts = [
    analysis.outfit_name || analysis.style || analysis.vibe,
    analysis.color_scheme,
    ...(analysis.pieces || []).slice(0, 3),
  ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0 && p.toLowerCase() !== 'none')

  const desc = parts.join(', ')
  if (isAr) {
    return mode === 'similar'
      ? `اقترح لي إطلالات مشابهة: ${desc}`
      : `أعد تصميم هذه الإطلالة بأسلوب مختلف: ${desc}`
  }
  return mode === 'similar'
    ? `suggest similar outfits: ${desc}`
    : `restyle this with a fresh take: ${desc}`
}

const ATTACHMENT_FEED_STATE_KEY = 'elephante_attachment_feed_state'

type PersistedAttachmentFeedState = {
  attachmentAnalysis: AttachmentAnalysis | null
  attachmentAnalysisMode: AttachmentAnalysisMode | null
  attachmentChat: AttachmentChatContext | null
  attachmentSuggestions: string[]
  attachmentTurns: FeedChatTurn[]
}

function readPersistedAttachmentFeedState(): PersistedAttachmentFeedState | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = sessionStorage.getItem(ATTACHMENT_FEED_STATE_KEY) || localStorage.getItem(ATTACHMENT_FEED_STATE_KEY)
    if (!saved) return null
    return JSON.parse(saved) as PersistedAttachmentFeedState
  } catch {
    return null
  }
}

function writePersistedAttachmentFeedState(state: PersistedAttachmentFeedState) {
  try {
    const serialized = JSON.stringify(state)
    sessionStorage.setItem(ATTACHMENT_FEED_STATE_KEY, serialized)
    localStorage.setItem(ATTACHMENT_FEED_STATE_KEY, serialized)
  } catch {}
}

function clearPersistedAttachmentFeedState() {
  try {
    sessionStorage.removeItem(ATTACHMENT_FEED_STATE_KEY)
    localStorage.removeItem(ATTACHMENT_FEED_STATE_KEY)
  } catch {}
}

function createAttachmentChatContext(attachment: WardrobeAttachment): AttachmentChatContext {
  const details = [
    attachment.item_name,
    attachment.item_type,
    attachment.color,
    attachment.occasion,
    ...(attachment.pieces || []),
  ].filter(Boolean).join(', ')

  return {
    imageUrl: attachment.image_url,
    imageLabel: attachment.item_name || attachment.item_type,
    itemName: attachment.item_name,
    itemType: attachment.item_type,
    pieces: attachment.pieces || [],
    color: attachment.color || '',
    occasion: attachment.occasion || '',
    details,
  }
}

function normalizeAnalysisScore(value: unknown) {
  const score = Number(value)
  if (!Number.isFinite(score)) return null
  return Math.max(0, Math.min(100, Math.round(score)))
}

function normalizeOutOf10(value: unknown, fallbackScore: number | null) {
  const score = Number(value)
  if (Number.isFinite(score)) {
    const normalized = score > 10 ? score / 10 : score
    return Math.max(0, Math.min(10, Math.round(normalized * 10) / 10))
  }
  return fallbackScore === null ? null : Math.max(0, Math.min(10, Math.round((fallbackScore / 10) * 10) / 10))
}

function visibleAttachmentPieces(analysis: AttachmentAnalysis) {
  return (analysis.pieces || [])
    .filter((piece) => {
      const normalized = piece.trim().toLowerCase()
      return normalized && !['null', 'none', 'n/a', 'na'].includes(normalized) && !normalized.includes('not visible') && !normalized.includes('not shown')
    })
}

function buildAttachmentAnalysisMessage(analysis: AttachmentAnalysis, isAr: boolean, mode: AttachmentAnalysisMode) {
  const score = normalizeAnalysisScore(analysis.match_score)
  const ratingOutOf10 = normalizeOutOf10(analysis.rating_out_of_10, score)
  const pieces = visibleAttachmentPieces(analysis)
  const inventoryLines = [
    analysis.outfit_name ? `${isAr ? 'الصورة' : 'Photo'}: ${analysis.outfit_name}` : null,
    pieces.length ? `${isAr ? 'أرى' : 'I see'}: ${pieces.join(isAr ? '، ' : ', ')}` : null,
    analysis.color_names?.length ? `${isAr ? 'الألوان' : 'Colors'}: ${analysis.color_names.join(isAr ? '، ' : ', ')}` : null,
    analysis.color_scheme ? `${isAr ? 'اللوحة' : 'Palette'}: ${analysis.color_scheme}` : null,
    analysis.occasions?.length ? `${isAr ? 'يناسب' : 'Could work for'}: ${analysis.occasions.join(isAr ? '، ' : ', ')}` : null,
  ].filter((line): line is string => Boolean(line))

  if (mode === 'inventory') {
    const lines = [
      ...inventoryLines,
      analysis.styling_tip ? `${isAr ? 'فكرة تنسيق' : 'Styling idea'}: ${analysis.styling_tip}` : null,
      isAr ? 'إذا أردت، أستطيع تقييم الإطلالة الآن.' : 'If you want, I can rate the outfit next.',
    ].filter((line): line is string => Boolean(line))

    return lines.join('\n\n') || (isAr ? 'حللت الصورة، لكن لم أستطع استخراج القطع بوضوح. جرّب صورة أوضح.' : 'I analyzed the photo, but could not clearly identify the pieces. Try a clearer image.')
  }

  const lines = [
    ...inventoryLines,
    analysis.overall_verdict ? `${isAr ? 'الحكم العام' : 'Overall'}: ${analysis.overall_verdict}` : null,
    analysis.skin_tone_feedback ? `${isAr ? 'لون البشرة' : 'Skin tone'}: ${analysis.skin_tone_feedback}` : null,
    analysis.why_it_works ? `${isAr ? 'لماذا تنجح' : 'Why it works'}: ${analysis.why_it_works}` : null,
    analysis.styling_tip ? `${isAr ? 'نصيحة' : 'Tip'}: ${analysis.styling_tip}` : null,
    ratingOutOf10 !== null ? (isAr ? `التقييم النهائي: ${ratingOutOf10}/10` : `Final rating: ${ratingOutOf10}/10`) : null,
  ].filter((line): line is string => Boolean(line))

  return lines.join('\n\n') || (isAr ? 'حللت الصورة، لكن لم أستطع استخراج رأي واضح. جرّب صورة أوضح للإطلالة.' : 'I analyzed the photo, but could not extract a clear verdict. Try a clearer outfit image.')
}

function FeedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang, isAr } = useLocale()
  const { loading: authLoading } = useRequireUser('/login')
  const initialQuery = searchParams?.get('q') || ''
  const replaceUrl = useCallback((url: string) => {
    router.replace(url, { scroll: false })
  }, [router])

  const kbOffset = useKeyboardOffset()

  // Chat display state
  const restoredAttachmentState = useState(() => readPersistedAttachmentFeedState())[0]
  const [pendingUserMessage, setPendingUserMessage] = useState('')
  const [chipDisplayMap, setChipDisplayMap] = useState<Record<string, string>>({})
  const [attachmentAnalysis, setAttachmentAnalysis] = useState<AttachmentAnalysis | null>(restoredAttachmentState?.attachmentAnalysis || null)
  const [attachmentAnalysisMode, setAttachmentAnalysisMode] = useState<AttachmentAnalysisMode | null>(restoredAttachmentState?.attachmentAnalysisMode || null)
  const [attachmentChat, setAttachmentChat] = useState<AttachmentChatContext | null>(restoredAttachmentState?.attachmentChat || null)
  const [attachmentSuggestions, setAttachmentSuggestions] = useState<string[]>(restoredAttachmentState?.attachmentSuggestions || [])
  const [attachmentTurns, setAttachmentTurns] = useState<FeedChatTurn[]>(restoredAttachmentState?.attachmentTurns || [])
  const [isAnalyzingAttachment, setIsAnalyzingAttachment] = useState(false)
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false)
  const prevHistoryLenRef = useRef(0)
  const dragDepthRef = useRef(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const didAutoCurate = useRef(false)
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
    userAvatarUrl,
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
    userAvatarUrl,
    language: lang,
    ready: !loading && !authLoading,
  })

  useEffect(() => {
    if (didAutoCurate.current || loading || authLoading || !userId || initialQuery) return
    didAutoCurate.current = true
    setSearchQuery(isAr ? 'اقترح لي إطلالات اليوم' : 'suggest outfits for me today')
    triggerCuration()
  }, [loading, authLoading, userId, initialQuery, isAr, setSearchQuery, triggerCuration])

  const {
    attachFile,
    attachment,
    clearAttachment,
    fileInputRef,
    handleAttachment,
  } = useWardrobeAttachment(
    userId,
    (query) => {
      setAttachmentAnalysis(null)
      setAttachmentAnalysisMode(null)
      setAttachmentChat(null)
      setAttachmentSuggestions([])
      setAttachmentTurns([])
      setInputValue(query)
      setSearchQuery(query)
    },
    () => {
      setInputValue('')
      setSearchQuery('')
      setAttachmentAnalysis(null)
      setAttachmentAnalysisMode(null)
      setAttachmentChat(null)
      setAttachmentSuggestions([])
      setAttachmentTurns([])
      clearActiveSearchState()
    }
  )

  useEffect(() => {
    writeLastFeedUrl(`${window.location.pathname}${window.location.search}`)
  }, [attachmentAnalysis, attachmentChat, attachmentTurns.length, generatedOutfit, searchQuery])

  useEffect(() => {
    if (!attachmentChat && attachmentTurns.length === 0 && !attachmentAnalysis) {
      clearPersistedAttachmentFeedState()
      return
    }

    writePersistedAttachmentFeedState({
      attachmentAnalysis,
      attachmentAnalysisMode,
      attachmentChat,
      attachmentSuggestions,
      attachmentTurns,
    })
  }, [attachmentAnalysis, attachmentAnalysisMode, attachmentChat, attachmentSuggestions, attachmentTurns])

  const attachPhotoFile = useCallback(async (file: File) => {
    setAttachmentAnalysis(null)
    setAttachmentAnalysisMode(null)
    setAttachmentChat(null)
    setAttachmentSuggestions([])
    setAttachmentTurns([])
    await attachFile(file)
  }, [attachFile])

  const handleQuickCurate = useCallback((mode: 'similar' | 'different') => {
    if (!attachment?.image_url || attachment.uploading) return
    const query = buildCurationQueryFromAttachment(attachment, isAr, mode)
    setAttachmentAnalysis(null)
    setAttachmentAnalysisMode(null)
    setAttachmentChat(null)
    setAttachmentSuggestions([])
    setAttachmentTurns([])
    clearAttachment({ clearSearch: false })
    setSearchQuery(query)
    setInputValue('')
    triggerCuration()
  }, [attachment, isAr, clearAttachment, setSearchQuery, setInputValue, triggerCuration])

  const handleAnalysisCurate = useCallback((mode: 'similar' | 'different') => {
    if (!attachmentAnalysis) return
    const query = buildCurationQueryFromAnalysis(attachmentAnalysis, isAr, mode)
    setAttachmentAnalysis(null)
    setAttachmentAnalysisMode(null)
    setAttachmentChat(null)
    setAttachmentSuggestions([])
    setAttachmentTurns([])
    setSearchQuery(query)
    setInputValue('')
    triggerCuration()
  }, [attachmentAnalysis, isAr, setSearchQuery, setInputValue, triggerCuration])


  useEffect(() => {
    const firstImageFile = (files: FileList | File[]) => Array.from(files).find((file) => file.type.startsWith('image/')) || null
    const hasImageFile = (event: DragEvent) => {
      return Array.from(event.dataTransfer?.items || []).some((item) => item.kind === 'file' && item.type.startsWith('image/'))
        || Array.from(event.dataTransfer?.files || []).some((file) => file.type.startsWith('image/'))
    }
    const clipboardImageFile = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files ? firstImageFile(event.clipboardData.files) : null
      if (file) return file

      const item = Array.from(event.clipboardData?.items || []).find((candidate) => candidate.kind === 'file' && candidate.type.startsWith('image/'))
      return item?.getAsFile() || null
    }

    const handlePaste = (event: ClipboardEvent) => {
      const file = clipboardImageFile(event)
      if (!file) return
      event.preventDefault()
      void attachPhotoFile(file)
    }

    const handleDragEnter = (event: DragEvent) => {
      if (!hasImageFile(event)) return
      event.preventDefault()
      dragDepthRef.current += 1
      setIsDraggingPhoto(true)
    }

    const handleDragOver = (event: DragEvent) => {
      if (!hasImageFile(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      setIsDraggingPhoto(true)
    }

    const handleDragLeave = () => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setIsDraggingPhoto(false)
    }

    const handleDrop = (event: DragEvent) => {
      if (!hasImageFile(event)) return
      event.preventDefault()
      dragDepthRef.current = 0
      setIsDraggingPhoto(false)
      const file = event.dataTransfer?.files ? firstImageFile(event.dataTransfer.files) : null
      if (file) void attachPhotoFile(file)
    }

    window.addEventListener('paste', handlePaste)
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('paste', handlePaste)
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [attachPhotoFile])

  const handleAnalyzeAttachment = useCallback(async (userRequest?: string, mode: AttachmentVisionMode = 'rating') => {
    const sourceAttachment = attachment?.image_url && !attachment.uploading ? attachment : null
    const nextAttachmentChat = sourceAttachment ? createAttachmentChatContext(sourceAttachment) : attachmentChat
    if (!nextAttachmentChat?.imageUrl) return

    const prompt = userRequest?.trim()
    const isQuestion = mode === 'question'
    if (isQuestion && !prompt) return

    const userText = prompt || (isAr ? 'تحليل الإطلالة' : 'Style Check')
    const priorTurns = sourceAttachment ? [] : attachmentTurns
    const userTurn: FeedChatTurn = {
      role: 'user',
      content: sourceAttachment ? `📎 ${userText}` : userText,
      imagePreview: sourceAttachment ? nextAttachmentChat.imageUrl : undefined,
    }

    setIsAnalyzingAttachment(true)
    setAttachmentChat(nextAttachmentChat)
    setAttachmentSuggestions([])
    setAttachmentAnalysisMode(isQuestion ? null : mode)
    if (sourceAttachment || !isQuestion) setAttachmentAnalysis(null)
    setAttachmentTurns([...priorTurns, userTurn])
    setPendingUserMessage('')
    setInputValue('')
    setSearchQuery('')
    clearActiveSearchState()

    if (sourceAttachment) clearAttachment({ clearSearch: false })

    try {
      const outfitDetails = [
        nextAttachmentChat.details,
        prompt ? `User request: ${prompt}` : null,
      ].filter(Boolean).join('\n')
      const response = await fetch('/api/analyze-outfit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: nextAttachmentChat.imageUrl,
          image_labels: [nextAttachmentChat.imageLabel],
          outfit_details: outfitDetails,
          question: isQuestion ? prompt : undefined,
          prior_analysis: attachmentAnalysis,
          prior_turns: priorTurns.map(({ role, content }) => ({ role, content })),
          skin_tone: userSkinTone || 'medium_neutral',
          gender: userGender || undefined,
          body_shape: userBodyShape || undefined,
          height_category: userHeight || undefined,
          language: lang,
          mode,
        }),
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      if (isQuestion) {
        const answer = typeof data.answer === 'string' && data.answer.trim()
          ? data.answer.trim()
          : (isAr ? 'أستطيع مساعدتك في هذه الصورة. اسألني عن التناسق أو الألوان أو كيف نطوّر الإطلالة.' : 'I can help with this photo. Ask me about the balance, colors, or how to improve the look.')
        setAttachmentSuggestions(Array.isArray(data.suggested_questions) ? data.suggested_questions.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 3) : [])
        setAttachmentTurns((previous) => [...previous, { role: 'assistant', content: answer }])
        return
      }

      const analysis = data.analysis as AttachmentAnalysis
      const analysisMode = mode
      setAttachmentAnalysis(analysis)
      setAttachmentAnalysisMode(analysisMode)
      setAttachmentSuggestions(isAr
        ? ['كيف أحسّنها؟', 'ما الحذاء الأنسب؟', 'اجعلها أكثر رسمية']
        : ['How can I improve it?', 'What shoes work best?', 'Make it more formal'])
      setAttachmentTurns((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: buildAttachmentAnalysisMessage(analysis, isAr, analysisMode),
          display: analysisMode === 'rating' ? 'analysis-card' : undefined,
        },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : (isAr ? 'تعذّر تحليل الصورة.' : 'Could not analyze the photo.')
      setAttachmentTurns((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: isAr
            ? `تعذّر تحليل الصورة. ${message}`
            : `I could not analyze that photo. ${message}`,
        },
      ])
    } finally {
      setPendingUserMessage('')
      setIsAnalyzingAttachment(false)
    }
  }, [
    attachment,
    attachmentAnalysis,
    attachmentChat,
    attachmentTurns,
    clearAttachment,
    clearActiveSearchState,
    isAr,
    lang,
    setInputValue,
    setSearchQuery,
    userBodyShape,
    userGender,
    userHeight,
    userSkinTone,
  ])

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
    if (pendingUserMessage || isThinking || isAnalyzingAttachment || chatHistory.length > 0 || attachmentTurns.length > 0 || attachmentAnalysis || attachmentChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [attachmentAnalysis, attachmentChat, attachmentTurns.length, chatHistory.length, finalBanner, isAnalyzingAttachment, isThinking, pendingUserMessage])

  // Chip tap: show chip label in chat, send full prompt to AI
  const handleChipTap = useCallback((chip: string) => {
    const prompt = buildFollowUpPrompt(chip)
    setAttachmentAnalysis(null)
    setAttachmentAnalysisMode(null)
    setAttachmentChat(null)
    setAttachmentSuggestions([])
    setAttachmentTurns([])
    setChipDisplayMap((previous) => ({ ...previous, [prompt]: chip }))
    setPendingUserMessage(chip)
    setInputValue('')
    setSearchQuery(prompt)
  }, [buildFollowUpPrompt, setInputValue, setSearchQuery])

  const handleAttachmentChipTap = useCallback((question: string) => {
    void handleAnalyzeAttachment(question, 'question')
  }, [handleAnalyzeAttachment])

  const boostedIds = useMemo(() => aiContext?.intent ? getBoostedOutfits(aiContext.intent) : [], [aiContext?.intent])
  const noImageLabel = isAr ? 'لا توجد صورة' : 'No image'

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
    if (!searchQuery) return []
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

  const isAttachmentAnalysisOpen = isAnalyzingAttachment || attachmentTurns.length > 0 || Boolean(attachmentAnalysis || attachmentChat)
  const isSearchSurfaceOpen = isSearching || isAttachmentAnalysisOpen
  const visibleChatHistory: FeedChatTurn[] = attachmentTurns.length > 0 ? attachmentTurns : chatHistory
  const attachmentFollowUpChips = attachmentSuggestions.length
    ? attachmentSuggestions
    : (isAr ? ['كيف أحسّنها؟', 'ما الحذاء الأنسب؟', 'اجعلها أكثر كاجوال'] : ['How can I improve it?', 'What shoes work best?', 'Make it more casual'])

  const translateFeedText = useArabicTranslations([
    ...filteredOutfits.map((outfit) => outfit.style || outfit.aesthetic?.replace(/^(male|female)\s+/i, '') || 'Outfit'),
    ...(generatedOutfit?.outfit ? [
      generatedOutfit.outfit.style,
      generatedOutfit.outfit.outfit_name,
      generatedOutfit.outfit.alternative?.style,
      generatedOutfit.outfit.alternative?.outfit_name,
    ] : []),
  ], isAr)

  if (loading || authLoading) return <LoadingScreen />

  return (
    <div className="bg-black text-white font-sans selection:bg-zinc-800" style={{ height: '100dvh' }}>
      {showTour ? <IntroTour onDone={() => setShowTour(false)} /> : null}

      <ParticleCanvas desktopCount={36} mobileCount={24} />

      {isDraggingPhoto ? (
        <div className="fixed inset-0 z-40 pointer-events-none bg-black/45 backdrop-blur-[2px] flex items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-[2rem] border border-white/25 bg-zinc-950/75 shadow-[0_0_80px_rgba(255,255,255,0.08)] px-6 py-8 text-center">
            <p className="text-[10px] uppercase tracking-[0.32em] text-white/85">{isAr ? 'اترك الصورة هنا' : 'Drop photo here'}</p>
          </div>
        </div>
      ) : null}

      <FeedHeader
        displayName={displayName}
        isSearching={isSearchSurfaceOpen}
        onGoHome={() => {
          setInputValue('')
          setSearchQuery('')
          setPendingUserMessage('')
          setChipDisplayMap({})
          setAttachmentAnalysis(null)
          setAttachmentAnalysisMode(null)
          setAttachmentChat(null)
          setAttachmentSuggestions([])
          setAttachmentTurns([])
          clearActiveSearchState()
        }}
        onOpenAiStylist={() => router.push('/ai-stylist')}
        onOpenCloset={() => router.push('/closet')}
        onOpenProfile={() => router.push('/profile')}
        onOpenTravelPack={() => router.push('/travel-pack')}
      />

      <div
        className="fixed left-0 right-0 z-20 overflow-y-auto overscroll-contain"
        style={{
          top: 0,
          bottom: 0,
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        {isSearchSurfaceOpen ? (
          <div className="px-4 sm:px-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ paddingTop: 'calc(max(2rem, env(safe-area-inset-top)) + 60px)' }}>

            {/* ── Chat thread ── */}
            <div className="flex flex-col gap-2.5 mb-4">
              {visibleChatHistory.map((turn, index) => {
                const isLatestAssistant = turn.role === 'assistant' && index === visibleChatHistory.length - 1 && Boolean(finalBanner) && attachmentTurns.length === 0
                const displayText = turn.role === 'user'
                  ? (chipDisplayMap[turn.content] ?? turn.content)
                  : turn.content
                const isFaded = index < visibleChatHistory.length - 2

                // Rating mode: replace the assistant text bubble with the visual card
                const isAttachmentRatingCard =
                  attachmentTurns.length > 0 &&
                  turn.role === 'assistant' &&
                  turn.display === 'analysis-card' &&
                  attachmentAnalysis != null

                if (isAttachmentRatingCard) {
                  return (
                    <div key={index} className="flex items-start gap-2 justify-start">
                      <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 mt-1">
                        <img src="/logo.png" alt="" className="w-9 h-9 object-contain" style={{ filter: 'invert(1)', opacity: 1 }} aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <OutfitAnalysisCard
                          analysis={attachmentAnalysis}
                          isAr={isAr}
                          onFindSimilar={() => handleAnalysisCurate('similar')}
                          onRestyle={() => handleAnalysisCurate('different')}
                        />
                      </div>
                    </div>
                  )
                }

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
                    <div className={`max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${
                      turn.role === 'user'
                        ? 'bg-zinc-800 text-white rounded-2xl rounded-br-sm'
                        : 'bg-zinc-900/80 border border-zinc-800/60 text-zinc-200 rounded-2xl rounded-bl-sm'
                    }`}>
                      {turn.imagePreview ? (
                        <div className="mb-2 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                          <img src={turn.imagePreview} alt="" className="w-full max-h-44 object-cover object-top" aria-hidden="true" />
                        </div>
                      ) : null}
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
                  <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 mb-2">{isAr ? 'لوحة ألوانك' : 'Your colour palette'}</p>
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
              {!isThinking && attachmentTurns.length === 0 && aiContext?.needs_clarification ? (
                <div className="ml-8 flex flex-wrap gap-2 animate-in fade-in duration-500" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
                  {(isAr ? ['كاجوال أنيق', 'رسمي / عمل', 'نهاية الأسبوع', 'سهرة', 'إطلالة صيفية'] : ['Smart Casual', 'Formal / Work', 'Weekend Casual', 'Night Out', 'Summer Look']).map((chip) => (
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
              {!isThinking && attachmentTurns.length === 0 && !aiContext?.needs_clarification && chatHistory.length >= 2 && finalBanner && !generatingOutfit ? (
                <div className="ml-8 flex flex-wrap gap-2 animate-in fade-in duration-500" style={{ animationDelay: '1000ms', animationFillMode: 'both' }}>
                  {(isAr ? ['أكثر رسمية', 'أكثر كاجوال', 'ألوان مختلفة', 'نسخة صيفية', 'نسخة للسهرة'] : ['More formal', 'More casual', 'Different colours', 'Summer version', 'Night out version']).map((chip) => (
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

              {/* Image follow-up chips */}
              {!isThinking && !isAnalyzingAttachment && attachmentChat && attachmentTurns.length > 0 ? (
                <div className="ml-8 flex flex-wrap gap-2 animate-in fade-in duration-500" style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
                  {attachmentFollowUpChips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleAttachmentChipTap(chip)}
                      className="px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-500 text-[11px] hover:border-zinc-600 hover:text-zinc-300 transition-all duration-200 active:scale-95"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}


              {/* Advice mode curate button */}
              {!isThinking && attachmentTurns.length === 0 && aiContext?.mode === 'advice' && !generatingOutfit && !generatedOutfit ? (
                <div className="ml-8 animate-in fade-in duration-700" style={{ animationDelay: '1200ms', animationFillMode: 'both' }}>
                  {!curateTriggered ? (
                    <button
                      onClick={triggerCuration}
                      className="px-5 py-2.5 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all duration-300 active:scale-95"
                    >
                      {isAr ? 'نعم، نسّقها لي ←' : 'Yes, curate for me →'}
                    </button>
                  ) : (
                    <p className="text-zinc-600 text-[10px] uppercase tracking-widest animate-pulse">{isAr ? 'جارٍ بناء إطلالتك...' : 'Building your look...'}</p>
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
              {isThinking || isAnalyzingAttachment ? (
                <div className="flex items-end gap-2">
                  <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                    <img src="/logo.png" alt="" className="w-9 h-9 object-contain" style={{ filter: 'invert(1)', opacity: 1 }} aria-hidden="true" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-zinc-900/80 border border-zinc-800/60">
                    <div className="flex gap-[5px] items-center" aria-label={isAr ? 'Elephante يفكر' : 'Elephante is thinking'}>
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
            {isSearching && (aiContext?.mode !== 'advice' || generatingOutfit || generatedOutfit) ? (
              <>
                {!isThinking && (filteredOutfits.length > 0 || generatingOutfit || generatedOutfit) ? (
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px bg-zinc-900 flex-1" />
                    <span className="text-zinc-700 text-[9px] uppercase tracking-widest">
                      {generatingOutfit
                        ? (isAr ? 'جارٍ إنشاء إطلالتك...' : 'Creating your look...')
                        : (generatedOutfit && filteredOutfits.length === 0)
                          ? (isAr ? 'إطلالة مولّدة' : 'Generated look')
                          : (isAr ? `${filteredOutfits.length} إطلالة` : `${filteredOutfits.length} outfit${filteredOutfits.length !== 1 ? 's' : ''}`)}
                    </span>
                    <div className="h-px bg-zinc-900 flex-1" />
                  </div>
                ) : null}

                {!isThinking && aiContext?.mode !== 'advice' && filteredOutfits.length === 0 && !generatingOutfit && !generatedOutfit ? (
                  <p className="text-zinc-700 text-[11px] text-center py-8 leading-relaxed">
                    {searchQuery ? feedTranslations[lang].emptySearch : feedTranslations[lang].emptyFeed}
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
                            <GeneratedOutfitImage src={generatedOutfit.image_url} alt={generatedOutfit.outfit?.outfit_name || (isAr ? 'إطلالة مولّدة' : 'Generated outfit')} className="w-full h-full object-cover object-top opacity-75 group-hover:opacity-100 transition-opacity duration-400" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><span className="text-zinc-800 text-[9px] uppercase tracking-widest">{noImageLabel}</span></div>
                          )}
                        </div>
                        {generatedOutfit.outfit?.style || generatedOutfit.outfit?.outfit_name ? (
                          <p className="mt-1.5 text-[9px] uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 truncate px-0.5 transition-colors duration-200">
                            {translateFeedText(generatedOutfit.outfit?.style || generatedOutfit.outfit?.outfit_name)}
                          </p>
                        ) : null}
                      </div>

                      {generatedOutfit.outfit?.alternative ? (
                        <div className="group cursor-pointer" style={{ opacity: 0, animation: 'cardIn 0.45s ease forwards', animationDelay: '80ms' }} onClick={() => handleGeneratedTap('alternative')}>
                          <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-900 transition-transform duration-300 group-hover:scale-[1.02] group-active:scale-[0.98]">
                            {generatedOutfit.alternative_image_url ? (
                              <GeneratedOutfitImage src={generatedOutfit.alternative_image_url} alt={generatedOutfit.outfit.alternative?.outfit_name || (isAr ? 'إطلالة مقترحة' : 'Suggested outfit')} className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity duration-400" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><span className="text-zinc-800 text-[9px] uppercase tracking-widest">{noImageLabel}</span></div>
                            )}
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[8px] uppercase tracking-widest text-zinc-400 border border-zinc-800/60">Alt</span>
                          </div>
                          {generatedOutfit.outfit.alternative?.style || generatedOutfit.outfit.alternative?.outfit_name ? (
                            <p className="mt-1.5 text-[9px] uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 truncate px-0.5 transition-colors duration-200">
                              {translateFeedText(generatedOutfit.outfit.alternative?.style || generatedOutfit.outfit.alternative?.outfit_name)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {filteredOutfits.map((outfit, index) => {
                    const isBoosted = boostedIds.includes(String(outfit.id))
                    const aiReason = aiContext?.suggestions?.find((suggestion) => String(suggestion.outfit_id) === String(outfit.id))?.reason
                    const tag = outfit.style || outfit.aesthetic?.replace(/^(male|female)\s+/i, '') || (isAr ? 'إطلالة' : 'Outfit')

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
                          <OutfitCardImage outfit={outfit} alt={tag} noImageLabel={noImageLabel} />
                          {isBoosted ? (
                            <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                          ) : null}
                        </div>
                        {aiReason ? (
                          <p className="mt-1.5 text-[10px] text-zinc-500 group-hover:text-zinc-400 leading-snug px-0.5 line-clamp-2 transition-colors duration-200">{aiReason}</p>
                        ) : (
                          <p className="mt-1.5 text-[9px] uppercase tracking-[0.2em] text-zinc-700 group-hover:text-zinc-500 truncate px-0.5 transition-colors duration-200">{translateFeedText(tag)}</p>
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
        attachmentAnalysis={attachmentAnalysis}
        attachmentAnalysisMode={attachmentAnalysisMode}
        clearAttachment={clearAttachment}
        fileInputRef={fileInputRef}
        handleAttachment={async (event) => {
          setAttachmentAnalysis(null)
          setAttachmentAnalysisMode(null)
          setAttachmentChat(null)
          setAttachmentSuggestions([])
          setAttachmentTurns([])
          await handleAttachment(event)
        }}
        handleAttachmentFile={attachPhotoFile}
        inputValue={inputValue}
        isAnalyzingAttachment={isAnalyzingAttachment}
        isThinking={isThinking}
        keyboardOffset={kbOffset}
        onAnalyzeAttachment={() => handleAnalyzeAttachment(inputValue, 'rating')}
        onRateAttachment={() => handleAnalyzeAttachment(inputValue, 'rating')}
        onFindSimilar={() => handleQuickCurate('similar')}
        onRestyle={() => handleQuickCurate('different')}
        onInputChange={(value) => {
          setInputValue(value)
          if (attachment || attachmentChat) return
          if (attachmentAnalysis) setAttachmentAnalysis(null)
          if (attachmentAnalysisMode) setAttachmentAnalysisMode(null)
          if (attachmentSuggestions.length) setAttachmentSuggestions([])
          if (attachmentTurns.length) setAttachmentTurns([])
          if (value === '') {
            setSearchQuery('')
            setPendingUserMessage('')
            setChipDisplayMap({})
            setAttachmentAnalysis(null)
            setAttachmentAnalysisMode(null)
            setAttachmentChat(null)
            setAttachmentSuggestions([])
            setAttachmentTurns([])
            clearActiveSearchState()
          }
        }}
        onSubmit={() => {
          const q = inputValue.trim()
          if (attachment?.uploading) return
          if (attachment?.image_url && !attachment.uploading) {
            const mode: AttachmentVisionMode = q ? 'question' : 'rating'
            void handleAnalyzeAttachment(q, mode)
            return
          }
          if (attachmentChat && attachmentTurns.length > 0) {
            if (!q) return
            void handleAnalyzeAttachment(q, 'question')
            return
          }
          if (!q) return
          setAttachmentAnalysis(null)
          setAttachmentAnalysisMode(null)
          setAttachmentChat(null)
          setAttachmentSuggestions([])
          setAttachmentTurns([])
          setPendingUserMessage(q)
          setSearchQuery(q)
          setInputValue('')
        }}
        placeholderOverlay={
          <SearchPlaceholder
            active={inputValue.length > 0}
            text={(attachment || attachmentChat) ? (isAr ? 'اسأل عن الصورة...' : 'Ask about this photo...') : undefined}
          />
        }
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
