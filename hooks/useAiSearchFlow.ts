'use client'

import type { MutableRefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { requestOutfitGeneration, requestOutfitSearch, type WeatherContext } from '@/services/feedSearchApi'
import { insertGeneratedOutfitBatch } from '@/services/outfitService'
import type { GeneratedOutfitResult } from '@/types/outfit'

type BannerColor = { hex: string; name: string }
type ChatTurn = { role: 'user' | 'assistant'; content: string }
type GeneratedOutfit = GeneratedOutfitResult | null

export type OutfitCardPieces = {
  top: string
  bottom: string
  shoes: string
  accessories?: string | null
  outerwear?: string | null
}

export type OutfitCard = {
  outfit_name: string
  style: string
  occasion: string
  vibe: string
  color_scheme: string
  key_colors: string[]
  pieces: OutfitCardPieces
  why_it_works: string
  styling_tip: string
  cultural_note?: string | null
}

export interface AiContext {
  mode?: string
  intent: string
  response: string
  vibe: string
  suggestions: Array<{ outfit_id: string; reason: string }>
  colors?: BannerColor[]
  needs_clarification?: boolean
  outfit_query?: string
  outfit_cards?: OutfitCard[]
}

interface AiSearchFlowParams {
  curateTriggered: boolean
  displayName: string
  isNaturalQuery: (query: string) => boolean
  searchQuery: string
  userBodyShape: string
  userGender: string
  userHeight: string
  userSkinTone: string
  userStylePref: string
  userAvatarUrl?: string
  weather?: WeatherContext | null
  initialAiContext?: AiContext | null
  initialChatHistory?: ChatTurn[]
  initialCompletedQuery?: string
  initialFinalBanner?: { text: string; vibe: string; colors?: BannerColor[] } | null
  initialGeneratedIds?: { primary?: string; alternative?: string }
  initialGeneratedOutfit?: GeneratedOutfit
  language?: 'en' | 'ar'
  ready?: boolean
}

export function useAiSearchFlow({
  curateTriggered,
  displayName,
  isNaturalQuery,
  searchQuery,
  userBodyShape,
  userGender,
  userHeight,
  userSkinTone,
  userStylePref,
  userAvatarUrl = '',
  weather = null,
  initialAiContext = null,
  initialChatHistory = [],
  initialCompletedQuery = '',
  initialFinalBanner = null,
  initialGeneratedIds = {},
  initialGeneratedOutfit = null,
  language = 'en',
  ready = true,
}: AiSearchFlowParams) {
  const [isThinking, setIsThinking] = useState(false)
  const [aiStatus, setAiStatus] = useState('Reading the room...')
  const isAr = language === 'ar'
  const statusCopy = {
    searching: isAr ? 'جارٍ التفكير في إطلالتك...' : 'Thinking about your look...',
    curating: isAr ? 'جارٍ تنسيق الإطلالة...' : 'Curating for you...',
    fallbackBanner: isAr ? 'هذه الإطلالة التي نسّقتها لك.' : "Here's what I put together for you.",
  }
  const [aiContext, setAiContext] = useState<AiContext | null>(initialAiContext)
  const [finalBanner, setFinalBanner] = useState<{ text: string; vibe: string; colors?: BannerColor[] } | null>(initialFinalBanner)
  const [generatedOutfit, setGeneratedOutfit] = useState<GeneratedOutfit>(initialGeneratedOutfit)
  const [generatingOutfit, setGeneratingOutfit] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>(initialChatHistory)
  const [generatedIds, setGeneratedIds] = useState<{ primary?: string; alternative?: string }>(initialGeneratedIds)
  const generatedIdsRef = useRef<{ primary?: string; alternative?: string }>(initialGeneratedIds)
  const chatHistoryRef = useRef<ChatTurn[]>([])
  const activeQueryRef = useRef(initialCompletedQuery)
  const activeWeatherKeyRef = useRef('')
  const completedQueryRef = useRef(initialCompletedQuery)
  const lastGeneratedForRef = useRef('')

  const weatherKey = (() => {
    if (!weather?.city || weather.temperature_c == null || !weather.condition) return ''
    return `${weather.city}|${Math.round(Number(weather.temperature_c))}|${weather.condition}`
  })()

  useEffect(() => { chatHistoryRef.current = chatHistory }, [chatHistory])
  useEffect(() => { generatedIdsRef.current = generatedIds }, [generatedIds])

  useEffect(() => {
    const query = searchQuery.trim()
    const isNewQuery = activeQueryRef.current !== query
    activeQueryRef.current = query
    let cancelled = false
    const isActiveQuery = () => !cancelled && activeQueryRef.current === query

    if (!query) {
      setAiContext(null)
      setFinalBanner(null)
      setGeneratedOutfit(null)
      setGeneratingOutfit(false)
      setGeneratedIds({})
      generatedIdsRef.current = {}
      lastGeneratedForRef.current = ''
      setIsThinking(false)
      return
    }

    if (!ready) {
      setIsThinking(false)
      return
    }

    if (isNewQuery) {
      completedQueryRef.current = ''
      setGeneratedOutfit(null)
      setGeneratingOutfit(false)
      setGeneratedIds({})
      generatedIdsRef.current = {}
      lastGeneratedForRef.current = ''
      setFinalBanner(null)
    }

    // Already completed this query — don't re-run (weather change alone doesn't re-trigger)
    if (!isNewQuery && completedQueryRef.current === query && !curateTriggered) {
      activeWeatherKeyRef.current = weatherKey
      setIsThinking(false)
      setGeneratingOutfit(false)
      return
    }

    const controller = new AbortController()
    setIsThinking(true)
    setAiStatus(statusCopy.searching)
    if (isNewQuery) setAiContext(null)

    const timer = setTimeout(async () => {
      if (!isActiveQuery()) return
      setAiStatus(statusCopy.curating)

      try {
        const data = await requestOutfitSearch({
          chatHistory: chatHistoryRef.current,
          displayName,
          query,
          userBodyShape,
          userGender,
          userHeight,
          userSkinTone,
          userStylePref,
          language,
          weather,
        }, controller.signal)

        if (!isActiveQuery()) return

        // ── Cards mode: outfit cards returned directly, no image generation needed ──
        if (data.mode === 'cards' && Array.isArray(data.cards) && data.cards.length > 0) {
          const context: AiContext = {
            mode: 'cards',
            intent: data.intent || query,
            response: data.response || '',
            vibe: data.vibe || '',
            suggestions: [],
            outfit_cards: data.cards,
          }
          setAiContext(context)
          if (data.response) {
            setChatHistory((prev) => [
              ...prev,
              { role: 'user', content: query },
              { role: 'assistant', content: data.response },
            ])
            setFinalBanner({ text: data.response, vibe: data.vibe || '' })
          }
          completedQueryRef.current = query
          setIsThinking(false)
          return
        }

        // ── Advice mode: styling knowledge, no outfit generation unless user triggers it ──
        if (data.mode === 'advice') {
          const context: AiContext = {
            mode: 'advice',
            intent: data.intent || query,
            response: data.response || '',
            vibe: '',
            suggestions: [],
            colors: data.colors,
          }
          setAiContext(context)
          if (data.response) {
            setChatHistory((prev) => [
              ...prev,
              { role: 'user', content: query },
              { role: 'assistant', content: data.response },
            ])
            setFinalBanner({ text: data.response, vibe: '', colors: data.colors || [] })
          }
          completedQueryRef.current = query
          setIsThinking(false)
          return
        }

        // ── Humor mode: off-topic redirect → generate a single outfit image ──
        // Any other fallback (mode: 'curation') just shows the response text, no auto-generation.
        const context: AiContext = data.response
          ? data
          : { mode: 'curation', intent: query, response: '', vibe: '', suggestions: [] }

        if (!isActiveQuery()) return
        setAiContext(context)

        if (context.response) {
          if (!isActiveQuery()) return
          setChatHistory((prev) => [
            ...prev,
            { role: 'user', content: query },
            { role: 'assistant', content: context.response },
          ])
          setFinalBanner({ text: context.response, vibe: context.vibe || '', colors: context.colors })
        }

        // Only auto-generate outfit image for humor/off-topic redirects
        if (context.mode !== 'humor') {
          completedQueryRef.current = query
          setIsThinking(false)
          return
        }

        const generationKey = weatherKey ? `${query}|weather:${weatherKey}` : query
        if (lastGeneratedForRef.current === generationKey) {
          completedQueryRef.current = query
          setIsThinking(false)
          return
        }

        lastGeneratedForRef.current = generationKey
        setIsThinking(false)
        setGeneratingOutfit(true)

        const outfitGenerationQuery = typeof context.outfit_query === 'string' && context.outfit_query.trim()
          ? context.outfit_query.trim()
          : query

        const generation = await requestOutfitGeneration({
          query: outfitGenerationQuery,
          userBodyShape,
          userGender,
          userHeight,
          userSkinTone,
          userStylePref,
          avatar_url: userAvatarUrl,
          language,
          weather,
        }, controller.signal)

        if (!isActiveQuery() || !generation.outfit) return

        setGeneratedOutfit(generation)
        completedQueryRef.current = query
        const bannerText = weather
          ? (generation.outfit.when_to_wear || generation.outfit.outfit_details || generation.outfit.skin_tone_analysis || generation.outfit.pro_tip || '')
          : (generation.outfit.skin_tone_analysis || generation.outfit.pro_tip || '')
        if (!isActiveQuery()) return
        setFinalBanner({ text: bannerText || statusCopy.fallbackBanner, vibe: generation.outfit.style || '' })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !isActiveQuery()) return

        const { data: inserted, error: saveError } = await insertGeneratedOutfitBatch(generation.outfit, {
          primaryImageUrl: generation.image_url,
          alternativeImageUrl: generation.alternative_image_url,
        })

        if (saveError) {
          console.error('[feed] generated outfit save failed:', saveError.message)
        }

        if (isActiveQuery() && inserted?.length) {
          const ids: { primary?: string; alternative?: string } = { primary: inserted[0]?.id }
          if (inserted[1]) ids.alternative = inserted[1].id
          generatedIdsRef.current = ids
          setGeneratedIds(ids)
          setGeneratedOutfit((previous) => previous ? {
            ...previous,
            image_url: inserted[0]?.image_url || previous.image_url,
            alternative_image_url: inserted[1]?.image_url || previous.alternative_image_url,
          } : previous)
        }
      } catch (error: any) {
        if (isActiveQuery()) {
          if (error?.name !== 'AbortError') {
            setAiContext({ intent: query, response: '', vibe: '', suggestions: [] })
          }
          setIsThinking(false)
        }
      } finally {
        if (isActiveQuery()) {
          setGeneratingOutfit(false)
          setIsThinking(false)
        }
      }
    }, 800)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort(new DOMException('Search cancelled', 'AbortError'))
    }
  }, [
    curateTriggered,
    displayName,
    language,
    ready,
    searchQuery,
    userAvatarUrl,
    userBodyShape,
    userGender,
    userHeight,
    userSkinTone,
    userStylePref,
    weather,
    weatherKey,
  ])

  return {
    aiContext,
    aiStatus,
    chatHistory,
    finalBanner,
    generatedIds,
    generatedIdsRef,
    generatedOutfit,
    generatingOutfit,
    isThinking,
    lastGeneratedForRef,
    setAiContext,
    setChatHistory,
    setFinalBanner,
    setGeneratedIds,
    setGeneratedOutfit,
    setGeneratingOutfit,
  }
}
