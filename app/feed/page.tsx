'use client'

import Image from 'next/image'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LoadingScreen from '@/app/components/LoadingScreen'
import IntroTour from '@/app/components/IntroTour'
import FeedHeader from '@/app/feed/components/FeedHeader'
import FeedOutfitCard from '@/app/feed/components/FeedOutfitCard'
import OutfitAnalysisCard from '@/app/feed/components/OutfitAnalysisCard'
import SearchFooter from '@/app/feed/components/SearchFooter'
import LoadingSpinner from '@/components/LoadingSpinner'
import ParticleCanvas from '@/components/ParticleCanvas'
import Logo from '@/components/Logo'
import { supabase } from '@/lib/supabase'
import { insertGeneratedOutfit } from '@/services/outfitService'
import { useLocale } from '@/lib/locale-context'
import { useKeyboardOffset } from '@/hooks/useFeedUi'
import { clearFeedState, isAutomaticFeedQuery, writeLastFeedUrl } from '@/hooks/useFeedStatePersistence'
import { useElephanteData } from '@/hooks/useElephanteData'
import { useFeedSearch } from '@/hooks/useFeedSearch'
import { useWardrobeAttachment, type WardrobeAttachment } from '@/hooks/useWardrobeAttachment'
import { useRequireUser } from '@/hooks/useRequireUser'
import { useArabicTranslations } from '@/hooks/useArabicTranslations'
import { canUseNextImage } from '@/lib/image'

const EN = 'What shall we dress you for today?'
const AR = '\u0628\u0645\u0627\u0630\u0627 \u0646\u064f\u0644\u0628\u0633\u0643 \u0627\u0644\u064a\u0648\u0645\u061f'
const NL_SIGNALS = ['suggest', 'suggestion', 'recommend', 'recommendation', 'help', 'need', 'want', 'have', 'going', 'date', 'event', 'tonight', 'evening', 'morning', 'special', 'something', 'occasion', 'meeting', 'interview', 'wedding', 'party', 'dinner', 'casual', 'formal', 'office', 'work', 'business', 'weekend', 'summer', 'winter', 'night', 'out', 'smart', 'what', 'which', 'give', 'me', 'feel', 'look', 'wear', 'style', 'fit', 'outfit', 'dress', 'rate']
const BUY_SIGNALS = ['buy', 'purchase', 'shop', 'get it', 'get me', 'find me', 'where to', 'where can', 'looking to buy', 'want to buy', 'to buy', 'order', 'pick up', 'from where', 'where from', 'اشتري', 'أشتري', 'أبحث عن', 'أريد شراء', 'من أين']
function hasBuyFollowUp(query: string): boolean {
  const lower = query.toLowerCase()
  return BUY_SIGNALS.some(s => lower.includes(s))
}
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
type WeatherInfo = {
  city: string
  temperature_c: number
  condition: string
  wind_kph?: number
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
  const rawInitialQuery = searchParams?.get('q') || ''
  const initialQuery = isAutomaticFeedQuery(rawInitialQuery) ? '' : rawInitialQuery
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
  const [weatherData, setWeatherData] = useState<WeatherInfo | null>(null)
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null)
  const weatherFetchedRef = useRef(false)
  const prevHistoryLenRef = useRef(0)
  const dragDepthRef = useRef(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const {
    displayName,
    loading,
    showTour,
    userBodyShape,
    userGender,
    userHeight,
    userId,
    userSkinTone,
    userStylePref,
    userAvatarUrl,
    setShowTour,
  } = useElephanteData(() => router.push('/login'))

  const fetchWeatherForLocation = useCallback(async () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude: lat, longitude: lon } = position.coords
          setUserCoords({ lat, lon })
          const response = await fetch('/api/weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon }),
          })
          if (!response.ok) return
          const data = await response.json().catch(() => ({}))
          if (data?.error) return
          setWeatherData({
            city: String(data.city || 'Your location'),
            temperature_c: Number(data.temperature_c),
            condition: String(data.condition || ''),
            wind_kph: Number.isFinite(Number(data.wind_kph)) ? Number(data.wind_kph) : undefined,
          })
        } catch {}
      },
      () => {}, // permission denied — silent
      { timeout: 8000 },
    )
  }, [])

  const {
    aiContext,
    buildFollowUpPrompt,
    chatHistory,
    clearActiveSearchState,
    curateTriggered,
    finalBanner,
    generatedIds,
    generatedOutfit,
    generatingOutfit,
    handleGeneratedTap,
    inputValue,
    isSearching,
    isThinking,
    searchQuery,
    setInputValue,
    setSearchQuery,
    triggerCuration,
    setAiContext,
    setFinalBanner,
    setGeneratedOutfit,
    setGeneratedIds,
    setChatHistory,
  } = useFeedSearch({
    displayName,
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
    weather: weatherData,
    ready: !loading && !authLoading,
  })

  useEffect(() => {
    if (!isAutomaticFeedQuery(rawInitialQuery)) return
    clearFeedState()
    replaceUrl('/feed')
  }, [rawInitialQuery, replaceUrl])

  const {
    attachFile,
    attachment,
    clearAttachment,
    fileInputRef,
    handleAttachment,
    analyzeWithAIServer,
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
    if (!isAutomaticFeedQuery(searchQuery)) return

    clearFeedState()
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
    replaceUrl('/feed')
  }, [searchQuery, clearActiveSearchState, replaceUrl, setInputValue, setSearchQuery])

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
    setChatHistory((prev) => [
      ...prev,
      { role: 'user', content: query, imagePreview: attachment.image_url }
    ])
    clearAttachment({ clearSearch: false })
    setInputValue('')
    setSearchQuery(query)
    triggerCuration()
  }, [attachment, isAr, clearAttachment, setSearchQuery, setInputValue, triggerCuration, setChatHistory])

  const handleAnalysisCurate = useCallback((mode: 'similar' | 'different', analysis: AttachmentAnalysis | null = attachmentAnalysis) => {
    if (!analysis) return
    const query = buildCurationQueryFromAnalysis(analysis, isAr, mode)
    setChatHistory((prev) => [
      ...prev,
      { role: 'user', content: query }
    ])
    setInputValue('')
    setSearchQuery(query)
    triggerCuration()
  }, [attachmentAnalysis, isAr, setSearchQuery, setInputValue, triggerCuration, setChatHistory])


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
    const priorTurns = chatHistory
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
    setChatHistory([...priorTurns, userTurn])
    setPendingUserMessage('')
    setInputValue('')
    setSearchQuery('')

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
        setChatHistory((previous) => [...previous, { role: 'assistant', content: answer }])
        return
      }

      const analysis = data.analysis as AttachmentAnalysis
      const analysisMode = mode
      setAttachmentAnalysis(analysis)
      setAttachmentAnalysisMode(analysisMode)
      setAttachmentSuggestions(isAr
        ? ['كيف أحسّنها؟', 'ما الحذاء الأنسب؟', 'اجعلها أكثر رسمية']
        : ['How can I improve it?', 'What shoes work best?', 'Make it more formal'])
      setChatHistory((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: buildAttachmentAnalysisMessage(analysis, isAr, analysisMode),
          display: analysisMode === 'rating' ? 'analysis-card' : undefined,
          analysis,
        },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : (isAr ? 'تعذّر تحليل الصورة.' : 'Could not analyze the photo.')
      setChatHistory((previous) => [
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
    chatHistory,
    clearAttachment,
    clearActiveSearchState,
    isAr,
    lang,
    setInputValue,
    setSearchQuery,
    setChatHistory,
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

  interface ChatSession {
    id: string
    title: string
    timestamp: number
    chatHistory: FeedChatTurn[]
    searchQuery: string
    aiContext: any
    finalBanner: any
    generatedOutfit: any
    generatedIds: any
  }

  const [chats, setChats] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  // Load chat sessions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('elephante_chats_history')
      if (stored) {
        setChats(JSON.parse(stored))
      }
      const activeId = localStorage.getItem('elephante_active_chat_id')
      if (activeId) {
        setActiveChatId(activeId)
      }
    } catch (e) {
      console.warn('Failed to load chats from localStorage:', e)
    }
  }, [])

  // Sync active chat session to localStorage whenever history or result states change
  useEffect(() => {
    if (chatHistory.length === 0) return

    let currentId = activeChatId

    if (!currentId) {
      currentId = `chat_${Date.now()}`
      setActiveChatId(currentId)
      localStorage.setItem('elephante_active_chat_id', currentId)

      const firstUserMsg = chatHistory.find(t => t.role === 'user')?.content || 'Style Chat'
      const title = firstUserMsg.replace(/^📎\s*/, '').slice(0, 36) + (firstUserMsg.length > 36 ? '...' : '')

      const newSession: ChatSession = {
        id: currentId,
        title,
        timestamp: Date.now(),
        chatHistory,
        searchQuery,
        aiContext,
        finalBanner,
        generatedOutfit,
        generatedIds,
      }
      
      setChats((prev) => {
        const next = [newSession, ...prev.filter(c => c.id !== newSession.id)]
        localStorage.setItem('elephante_chats_history', JSON.stringify(next))
        return next
      })
    } else {
      setChats((prev) => {
        const index = prev.findIndex(c => c.id === currentId)
        let next = [...prev]
        if (index !== -1) {
          next[index] = {
            ...next[index]!,
            chatHistory,
            searchQuery,
            aiContext,
            finalBanner,
            generatedOutfit,
            generatedIds,
          }
        } else {
          const firstUserMsg = chatHistory.find(t => t.role === 'user')?.content || 'Style Chat'
          const title = firstUserMsg.replace(/^📎\s*/, '').slice(0, 36) + (firstUserMsg.length > 36 ? '...' : '')
          next = [{
            id: currentId!,
            title,
            timestamp: Date.now(),
            chatHistory,
            searchQuery,
            aiContext,
            finalBanner,
            generatedOutfit,
            generatedIds,
          }, ...next]
        }
        localStorage.setItem('elephante_chats_history', JSON.stringify(next))
        return next
      })
    }
  }, [chatHistory, searchQuery, aiContext, finalBanner, generatedOutfit, generatedIds, activeChatId])

  const handleLoadChat = useCallback((id: string) => {
    setChats((prev) => {
      const chat = prev.find(c => c.id === id)
      if (chat) {
        setActiveChatId(chat.id)
        localStorage.setItem('elephante_active_chat_id', chat.id)
        
        setInputValue('')
        setSearchQuery('')
        setChatHistory(chat.chatHistory || [])
        setAiContext(chat.aiContext || null)
        setFinalBanner(chat.finalBanner || null)
        setGeneratedOutfit(chat.generatedOutfit || null)
        setGeneratedIds(chat.generatedIds || {})
        
        clearAttachment({ clearSearch: false })
        setAttachmentAnalysis(null)
        setAttachmentAnalysisMode(null)
        setAttachmentChat(null)
        setAttachmentSuggestions([])
      }
      return prev
    })
  }, [setInputValue, setSearchQuery, setChatHistory, setAiContext, setFinalBanner, setGeneratedOutfit, setGeneratedIds, clearAttachment])

  const handleDeleteChat = useCallback((id: string) => {
    setChats((prev) => {
      const next = prev.filter(c => c.id !== id)
      localStorage.setItem('elephante_chats_history', JSON.stringify(next))
      return next
    })
    
    setActiveChatId((currentId) => {
      if (currentId === id) {
        localStorage.removeItem('elephante_active_chat_id')
        setInputValue('')
        setSearchQuery('')
        setPendingUserMessage('')
        setChipDisplayMap({})
        setAttachmentAnalysis(null)
        setAttachmentAnalysisMode(null)
        setAttachmentChat(null)
        setAttachmentSuggestions([])
        clearActiveSearchState()
        return null
      }
      return currentId
    })
  }, [setInputValue, setSearchQuery, clearActiveSearchState])

  const handleNewChat = useCallback(() => {
    setActiveChatId(null)
    localStorage.removeItem('elephante_active_chat_id')
    
    setInputValue('')
    setSearchQuery('')
    setPendingUserMessage('')
    setChipDisplayMap({})
    setAttachmentAnalysis(null)
    setAttachmentAnalysisMode(null)
    setAttachmentChat(null)
    setAttachmentSuggestions([])
    clearActiveSearchState()
  }, [setInputValue, setSearchQuery, clearActiveSearchState])

  const handleInlineGeneratedTap = async (inlineGeneratedOutfit: any, type: 'primary' | 'alternative') => {
    if (!inlineGeneratedOutfit) return

    const existingId = generatedIds[type]
    if (existingId) {
      router.push(`/outfit/${existingId}`)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const isAlternative = type === 'alternative'
      const outfit = isAlternative ? inlineGeneratedOutfit.outfit?.alternative : inlineGeneratedOutfit.outfit
      const primaryOutfit = inlineGeneratedOutfit.outfit || {}
      const imageUrl = isAlternative ? inlineGeneratedOutfit.alternative_image_url : inlineGeneratedOutfit.image_url

      const { data: inserted } = await insertGeneratedOutfit(outfit, {
        type,
        primaryOutfit,
        imageUrl,
      })

      if (inserted?.id) {
        setGeneratedIds((prev) => ({ ...prev, [type]: inserted.id }))
        setChatHistory((prev) => {
          const next = [...prev]
          for (let i = next.length - 1; i >= 0; i--) {
            const turn = next[i]
            if (turn && turn.role === 'assistant' && turn.generatedOutfit === inlineGeneratedOutfit) {
              next[i] = {
                ...turn,
                generatedOutfit: isAlternative
                  ? { ...turn.generatedOutfit!, alternative_image_url: inserted.image_url } as typeof turn.generatedOutfit
                  : { ...turn.generatedOutfit!, image_url: inserted.image_url } as typeof turn.generatedOutfit
              }
              break
            }
          }
          return next
        })
        router.push(`/outfit/${inserted.id}`)
      }
    } catch {}
  }

  // Chip tap: show chip label in chat, send full prompt to AI
  const handleChipTap = useCallback((chip: string) => {
    const prompt = buildFollowUpPrompt(chip)
    setAttachmentAnalysis(null)
    setAttachmentAnalysisMode(null)
    setAttachmentChat(null)
    setAttachmentSuggestions([])
    setChipDisplayMap((previous) => ({ ...previous, [prompt]: chip }))
    setPendingUserMessage(chip)
    setInputValue('')
    setSearchQuery(prompt)
  }, [buildFollowUpPrompt, setInputValue, setSearchQuery])

  const handleAttachmentChipTap = useCallback((question: string) => {
    void handleAnalyzeAttachment(question, 'question')
  }, [handleAnalyzeAttachment])

  const noImageLabel = isAr ? 'لا توجد صورة' : 'No image'

  const isAttachmentAnalysisOpen = isAnalyzingAttachment || Boolean(attachmentChat)
  const isSearchSurfaceOpen = isSearching || isAttachmentAnalysisOpen || chatHistory.length > 0

  // Request geolocation once the app is ready — triggers the browser permission prompt on first visit
  useEffect(() => {
    if (loading || authLoading || weatherFetchedRef.current) return
    weatherFetchedRef.current = true
    void fetchWeatherForLocation()
  }, [loading, authLoading, fetchWeatherForLocation])

  const weatherDisplay = weatherData
    ? `${Math.round(weatherData.temperature_c)}°C · ${weatherData.city} · ${weatherData.condition}`
    : ''
  const attachmentFollowUpChips = attachmentSuggestions.length
    ? attachmentSuggestions
    : (isAr ? ['كيف أحسّنها؟', 'ما الحذاء الأنسب؟', 'اجعلها أكثر كاجوال'] : ['How can I improve it?', 'What shoes work best?', 'Make it more casual'])

  const translateFeedText = useArabicTranslations([
    ...(generatedOutfit?.outfit ? [
      generatedOutfit.outfit.style,
      generatedOutfit.outfit.outfit_name,
      generatedOutfit.outfit.alternative?.style,
      generatedOutfit.outfit.alternative?.outfit_name,
    ] : []),
  ], isAr)

  if (loading || authLoading) return (
    <div className="bg-black text-white font-sans" style={{ height: '100dvh' }}>
      <ParticleCanvas desktopCount={36} mobileCount={24} />

      {/* Top-left hamburger placeholder */}
      <div
        className="fixed z-50 w-5 h-5 rounded skeleton opacity-20"
        style={{ top: 'max(2rem, env(safe-area-inset-top))', left: '1rem', marginTop: '0.125rem' }}
      />

      {/* Top-right closet icon placeholder */}
      <div
        className="fixed z-50 w-5 h-5 rounded skeleton opacity-20"
        style={{ top: 'max(2rem, env(safe-area-inset-top))', right: '1rem', marginTop: '0.125rem' }}
      />

      {/* Centred logo + username skeleton */}
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none z-40">
        <Logo size={96} opacity={0.25} decorative className="animate-pulse" />
        <div className="h-2.5 w-20 rounded-full skeleton opacity-20" />
      </div>

      {/* Bottom search bar skeleton */}
      <div
        className="fixed left-0 right-0 z-50 pt-5 px-4"
        style={{ bottom: 0, paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <div className="flex-shrink-0 w-[52px] h-[56px] rounded-3xl skeleton opacity-20" />
          <div className="flex-1 h-[56px] rounded-3xl skeleton opacity-20" />
        </div>
      </div>
    </div>
  )

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
        onGoHome={handleNewChat}
        onOpenAiStylist={() => router.push('/ai-stylist')}
        onOpenCloset={() => router.push('/closet')}
        onOpenProfile={() => router.push('/profile')}
        onOpenOutfitBuilder={() => router.push('/outfit-builder')}
        onOpenTravelPack={() => router.push('/travel-pack')}
        chats={chats}
        activeChatId={activeChatId}
        onLoadChat={handleLoadChat}
        onDeleteChat={handleDeleteChat}
        onNewChat={handleNewChat}
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
          <div className="px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ paddingTop: 'calc(max(2rem, env(safe-area-inset-top)) + 60px)', paddingBottom: 'calc(max(2rem, env(safe-area-inset-bottom)) + 140px)' }}>

            {/* ── Feed thread ── */}
            <div className="flex flex-col gap-6 mb-4 max-w-5xl mx-auto w-full">
              {chatHistory.map((turn, index) => {
                const displayText = turn.role === 'user'
                  ? (chipDisplayMap[turn.content] ?? turn.content)
                  : turn.content

                // Rating mode: render analysis card inline
                if (turn.role === 'assistant' && turn.display === 'analysis-card' && turn.analysis != null) {
                  return (
                    <OutfitAnalysisCard
                      key={index}
                      analysis={turn.analysis}
                      isAr={isAr}
                      onFindSimilar={() => handleAnalysisCurate('similar', turn.analysis)}
                      onRestyle={() => handleAnalysisCurate('different', turn.analysis)}
                    />
                  )
                }

                const isUser = turn.role === 'user'

                // User query: right-aligned compact pill
                if (isUser) {
                  return (
                    <div key={index} className="flex justify-end">
                      <div className="px-4 py-2 rounded-2xl rounded-br-sm bg-zinc-800/70 border border-zinc-700/40 text-white text-[13px] leading-relaxed max-w-[70%]">
                        {turn.imagePreview ? (
                          <div className="mb-2 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                            <img src={turn.imagePreview} alt="" className="w-full max-h-44 object-cover object-top" aria-hidden="true" />
                          </div>
                        ) : null}
                        {displayText}
                      </div>
                    </div>
                  )
                }

                // Assistant with outfit cards: full-width grid
                if (turn.outfitCards && turn.outfitCards.length > 0) {
                  return (
                    <div key={index} className="flex flex-col gap-4">
                      {displayText ? (
                        <p className="text-[13px] text-zinc-400 leading-relaxed">{displayText}</p>
                      ) : null}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {turn.outfitCards.map((card, idx) => (
                          <FeedOutfitCard
                            key={idx}
                            card={card}
                            index={idx}
                            userGender={userGender}
                            userSkinTone={userSkinTone}
                            userBodyShape={userBodyShape}
                            userHeight={userHeight}
                            userStylePref={userStylePref}
                            language={lang}
                            isAr={isAr}
                          />
                        ))}
                      </div>
                    </div>
                  )
                }

                // Assistant with generated outfit images
                if (turn.generatedOutfit) {
                  return (
                    <div key={index} className="flex flex-col gap-3">
                      {displayText ? (
                        <p className="text-[13px] text-zinc-300 leading-relaxed">{displayText}</p>
                      ) : null}
                      <div className="grid grid-cols-2 gap-3 max-w-xs">
                        <div className="group cursor-pointer" onClick={() => handleInlineGeneratedTap(turn.generatedOutfit, 'primary')}>
                          <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/50 transition-all duration-300 group-hover:scale-[1.01] shadow-sm">
                            {turn.generatedOutfit.image_url ? (
                              <GeneratedOutfitImage src={turn.generatedOutfit.image_url} alt="" className="w-full h-full object-cover object-top opacity-85 hover:opacity-100 transition-opacity duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><span className="text-zinc-800 text-[8px] uppercase tracking-widest">{noImageLabel}</span></div>
                            )}
                          </div>
                          <p className="mt-1 text-[8px] uppercase tracking-wider text-zinc-500 truncate">{translateFeedText(turn.generatedOutfit.outfit?.style || turn.generatedOutfit.outfit?.outfit_name)}</p>
                        </div>
                        {turn.generatedOutfit.outfit?.alternative && (
                          <div className="group cursor-pointer" onClick={() => handleInlineGeneratedTap(turn.generatedOutfit, 'alternative')}>
                            <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/50 transition-all duration-300 group-hover:scale-[1.01] shadow-sm">
                              {turn.generatedOutfit.alternative_image_url ? (
                                <GeneratedOutfitImage src={turn.generatedOutfit.alternative_image_url} alt="" className="w-full h-full object-cover object-top opacity-85 hover:opacity-100 transition-opacity duration-300" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><span className="text-zinc-800 text-[8px] uppercase tracking-widest">{noImageLabel}</span></div>
                              )}
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-[7px] uppercase tracking-widest text-zinc-400 border border-zinc-800">Alt</span>
                            </div>
                            <p className="mt-1 text-[8px] uppercase tracking-wider text-zinc-500 truncate">{translateFeedText(turn.generatedOutfit.outfit.alternative.style || turn.generatedOutfit.outfit.alternative.outfit_name)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                // Generating skeleton
                if (!isUser && generatingOutfit && index === chatHistory.length - 1) {
                  return (
                    <div key={index} className="flex flex-col gap-3">
                      {displayText ? <p className="text-[13px] text-zinc-400 leading-relaxed">{displayText}</p> : null}
                      <div className="grid grid-cols-2 gap-3 max-w-xs">
                        {[0, 1].map((v) => (
                          <div key={v}>
                            <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl skeleton shadow-sm" />
                            <div className="mt-1.5 h-2 rounded-full skeleton w-2/3" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }

                // Default: plain text response + colors
                return (
                  <div key={index} className="flex flex-col gap-3">
                    {displayText ? (
                      <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-line">{displayText}</p>
                    ) : null}
                    {turn.colors && turn.colors.length > 0 && (
                      <div>
                        <p className="text-[8px] uppercase tracking-[0.25em] text-zinc-600 mb-2">{isAr ? 'لوحة ألوانك' : 'Your colour palette'}</p>
                        <div className="flex flex-wrap gap-2">
                          {turn.colors.map((color) => (
                            <div key={`${color.hex}-${color.name}`} className="flex flex-col items-center gap-0.5">
                              <div className="w-7 h-7 rounded-full border border-zinc-800/80 shadow-sm" style={{ backgroundColor: color.hex }} title={color.name} />
                              <span className="text-[7px] text-zinc-600 text-center leading-tight max-w-[32px] truncate">{color.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Clarification chips — shown as quick-reply options */}
              {!isThinking && !attachmentChat && aiContext?.needs_clarification ? (
                <div className="flex flex-wrap gap-2 animate-in fade-in duration-500" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
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
              {!isThinking && !attachmentChat && !aiContext?.needs_clarification && chatHistory.length >= 2 && finalBanner && !generatingOutfit ? (
                <div className="flex flex-wrap gap-2 animate-in fade-in duration-500" style={{ animationDelay: '1000ms', animationFillMode: 'both' }}>
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
              {!isThinking && !isAnalyzingAttachment && attachmentChat && chatHistory.length > 0 ? (
                <div className="flex flex-wrap gap-2 animate-in fade-in duration-500" style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
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
              {!isThinking && !attachmentChat && aiContext?.mode === 'advice' && !generatingOutfit && !generatedOutfit ? (
                <div className="animate-in fade-in duration-700" style={{ animationDelay: '1200ms', animationFillMode: 'both' }}>
                  {!curateTriggered ? (
                    <button
                      onClick={triggerCuration}
                      className="px-5 py-2.5 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all duration-300 active:scale-95"
                    >
                      {isAr ? 'نعم، نسّقها لي ←' : 'Yes, curate for me →'}
                    </button>
                  ) : (
                    <p className="text-zinc-650 text-[10px] uppercase tracking-widest animate-pulse">{isAr ? 'جارٍ بناء إطلالتك...' : 'Building your look...'}</p>
                  )}
                </div>
              ) : null}

              {/* Pending user bubble */}
              {pendingUserMessage ? (
                <div className="flex justify-end">
                  <div className="px-4 py-2 rounded-2xl rounded-br-sm bg-zinc-800/70 border border-zinc-700/40 text-white text-[13px] leading-relaxed max-w-[70%]">
                    {pendingUserMessage}
                  </div>
                </div>
              ) : null}

              {/* Thinking indicator */}
              {(isThinking || isAnalyzingAttachment) ? (
                <div className="flex items-center gap-2">
                  <Logo size={14} className="text-zinc-600 animate-pulse" />
                  <div className="flex gap-[5px] items-center" aria-label={isAr ? 'Elephante يفكر' : 'Elephante is thinking'}>
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              ) : null}

              <div ref={chatEndRef} />
            </div>

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
          await handleAttachment(event)
        }}
        handleAttachmentFile={attachPhotoFile}
        inputValue={inputValue}
        isAnalyzingAttachment={isAnalyzingAttachment}
        isThinking={isThinking}
        keyboardOffset={kbOffset}
        onAnalyzeAttachment={() => handleAnalyzeAttachment(inputValue, 'rating')}
        onAnalyzeWithAIServer={analyzeWithAIServer}
        onRateAttachment={() => handleAnalyzeAttachment(inputValue, 'rating')}
        onFindSimilar={() => handleQuickCurate('similar')}
        onRestyle={() => handleQuickCurate('different')}
        onInputChange={(value) => {
          setInputValue(value)
          if (attachment || attachmentChat) return
          if (attachmentAnalysis) setAttachmentAnalysis(null)
          if (attachmentAnalysisMode) setAttachmentAnalysisMode(null)
          if (attachmentSuggestions.length) setAttachmentSuggestions([])
          if (value === '') {
            setSearchQuery('')
            setPendingUserMessage('')
            setChipDisplayMap({})
            setAttachmentAnalysis(null)
            setAttachmentAnalysisMode(null)
            setAttachmentChat(null)
            setAttachmentSuggestions([])
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
          if (attachmentChat && chatHistory.length > 0) {
            if (!q) return
            void handleAnalyzeAttachment(q, 'question')
            return
          }
          if (!q) return
          // Intercept buy-intent follow-ups when outfit cards are already on screen
          const hasOutfitCards = chatHistory.some(t => t.outfitCards && t.outfitCards.length > 0)
          if (hasBuyFollowUp(q) && hasOutfitCards) {
            const hint = isAr
              ? 'لرؤية روابط التسوق لكل قطعة والعثور على متاجر قريبة، انقر على "المزيد ←" في أي بطاقة إطلالة أعلاه.'
              : 'Tap MORE → on any outfit card above to see shop links for each piece and find nearby stores where you can buy or get it tailored.'
            setChatHistory(prev => [
              ...prev,
              { role: 'user', content: q },
              { role: 'assistant', content: hint },
            ])
            setInputValue('')
            return
          }
          setAttachmentAnalysis(null)
          setAttachmentAnalysisMode(null)
          setAttachmentChat(null)
          setAttachmentSuggestions([])
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
