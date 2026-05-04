'use client'

import type { MutableRefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { requestOutfitGeneration, requestOutfitSearch } from '@/services/feedSearchApi'
import { insertGeneratedOutfitBatch } from '@/services/outfitService'
import type { GeneratedOutfitResult, Outfit } from '@/types/outfit'

type Suggestion = { outfit_id: string; reason: string }
type BannerColor = { hex: string; name: string }
type ChatTurn = { role: 'user' | 'assistant'; content: string }
type GeneratedOutfit = GeneratedOutfitResult | null

interface AiContext {
  mode?: string
  intent: string
  response: string
  vibe: string
  suggestions: Suggestion[]
  colors?: BannerColor[]
  needs_clarification?: boolean
}

interface AiSearchFlowParams {
  allOutfits: Outfit[]
  allOutfitsRef: MutableRefObject<Outfit[]>
  curateTriggered: boolean
  displayName: string
  getOutfitGender: (outfit: Outfit) => 'male' | 'female' | 'unisex'
  isNaturalQuery: (query: string) => boolean
  searchQuery: string
  userBodyShape: string
  userGender: string
  userHeight: string
  userSkinTone: string
  userStylePref: string
}

export function useAiSearchFlow({
  allOutfits,
  allOutfitsRef,
  curateTriggered,
  displayName,
  getOutfitGender,
  isNaturalQuery,
  searchQuery,
  userBodyShape,
  userGender,
  userHeight,
  userSkinTone,
  userStylePref,
}: AiSearchFlowParams) {
  const [isThinking, setIsThinking] = useState(false)
  const [aiStatus, setAiStatus] = useState('Reading the room...')
  const [aiContext, setAiContext] = useState<AiContext | null>(null)
  const [finalBanner, setFinalBanner] = useState<{ text: string; vibe: string; colors?: BannerColor[] } | null>(null)
  const [generatedOutfit, setGeneratedOutfit] = useState<GeneratedOutfit>(null)
  const [generatingOutfit, setGeneratingOutfit] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([])
  const [generatedIds, setGeneratedIds] = useState<{ primary?: string; alternative?: string }>({})
  const generatedIdsRef = useRef<{ primary?: string; alternative?: string }>({})
  const chatHistoryRef = useRef<ChatTurn[]>([])
  const activeQueryRef = useRef('')
  const lastGeneratedForRef = useRef('')
  const serializedOutfits = useMemo(
    () =>
      allOutfits.map((outfit) => ({
        id: outfit.id,
        outfit_code: outfit.outfit_code,
        style: outfit.style_category || outfit.style,
        occasion: outfit.occasions || outfit.occasion,
        aesthetic: outfit.aesthetic,
        top: outfit.top_wear || outfit.top,
        bottom: outfit.bottom_wear,
        shoes: outfit.shoes,
        accessories: outfit.accessories,
        outerwear: outfit.outerwear,
        when_to_wear: outfit.when_to_wear,
        color_scheme: outfit.color_scheme,
        outfit_details: outfit.outfit_details,
        pieces: outfit.pieces,
        colors: outfit.colors || outfit.hex_colors,
        image_url: outfit.image_url,
      })),
    [allOutfits]
  )

  useEffect(() => {
    chatHistoryRef.current = chatHistory
  }, [chatHistory])

  useEffect(() => {
    generatedIdsRef.current = generatedIds
  }, [generatedIds])

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

    if (isNewQuery) {
      setGeneratedOutfit(null)
      setGeneratingOutfit(false)
      setGeneratedIds({})
      generatedIdsRef.current = {}
      lastGeneratedForRef.current = ''
      setFinalBanner(null)
    }

    if (!isNaturalQuery(query)) {
      setAiContext(null)
      setChatHistory([])
      setAiStatus('Searching archive...')
      const timer = setTimeout(() => {
        if (activeQueryRef.current === query) setIsThinking(false)
      }, 600)
      return () => { cancelled = true; clearTimeout(timer) }
    }
    const controller = new AbortController()
    setIsThinking(true)
    setAiStatus('Searching archive...')
    if (isNewQuery) setAiContext(null)

    const timer = setTimeout(async () => {
      if (!isActiveQuery()) return

      setAiStatus('Curating for you...')

      try {
        const data = await requestOutfitSearch({
          chatHistory: chatHistoryRef.current,
          displayName,
          query,
          serializedOutfits,
          userBodyShape,
          userGender,
          userHeight,
          userSkinTone,
          userStylePref,
        }, controller.signal)

        if (!isActiveQuery()) return

        const context = data.response ? data : { mode: 'curation', intent: query, response: '', vibe: '', suggestions: [] }
        if (!isActiveQuery()) return
        setAiContext(context)

        if (context.mode === 'advice') {
          if (!isActiveQuery()) return
          setFinalBanner({ text: context.response, vibe: '', colors: context.colors || [] })
        } else if (context.suggestions?.length && context.response) {
          if (!isActiveQuery()) return
          setFinalBanner({ text: context.response, vibe: context.vibe || '' })
        }

        if (context.response) {
          if (!isActiveQuery()) return
          setChatHistory((prev) => [
            ...prev,
            { role: 'user', content: query },
            { role: 'assistant', content: context.response },
          ])
        }

        const resolved = (context.suggestions || []).filter((suggestion: Suggestion) => {
          const outfit = allOutfitsRef.current.find((item) => String(item.id) === String(suggestion.outfit_id))
          if (!outfit) return false
          const outfitGender = getOutfitGender(outfit)
          return outfitGender === 'unisex' || outfitGender === userGender
        })

        if (resolved.length > 0 || (context.mode === 'advice' && !curateTriggered) || lastGeneratedForRef.current === query) {
          setIsThinking(false)
          return
        }

        // Don't generate when the query is ambiguous — user owns an item but hasn't
        // specified occasion or style. Show clarification chips instead.
        const OCCASION_SIGNALS = ['wedding', 'office', 'work', 'formal', 'casual', 'party', 'date', 'interview', 'dinner', 'night out', 'night', 'beach', 'gym', 'sport', 'summer', 'winter', 'meeting', 'event', 'festival', 'travel', 'smart', 'weekend', 'outdoor']
        const isPossessionQuery = /^(i have|i own|i('ve| ve) got|i got|i'?m wearing|wearing my|i wear)\b/i.test(query.trim())
        const hasOccasionContext = OCCASION_SIGNALS.some((sig) => query.toLowerCase().includes(sig))

        if (isPossessionQuery && !hasOccasionContext) {
          setAiContext({ ...context, needs_clarification: true })
          // If suggestions were empty, finalBanner wasn't set yet — set a clarification banner
          const bannerAlreadySet = Boolean(context.suggestions?.length && context.response)
          if (!bannerAlreadySet) {
            const owned = query.replace(/^(i have|i own|i('ve| ve) got|i got|i'?m wearing|wearing my|i wear)\s+/i, '').trim()
            setFinalBanner({
              text: context.response || `Great piece to work with! What are you dressing for — formal, casual, a night out?`,
              vibe: context.vibe || owned,
            })
          }
          setIsThinking(false)
          return
        }

        lastGeneratedForRef.current = query
        setIsThinking(false)
        setGeneratingOutfit(true)

        const generation = await requestOutfitGeneration({
          query,
          userBodyShape,
          userGender,
          userHeight,
          userSkinTone,
          userStylePref,
        }, controller.signal)

        if (!isActiveQuery() || !generation.outfit) return

        setGeneratedOutfit(generation)
        const bannerText = generation.outfit.skin_tone_analysis || generation.outfit.pro_tip || ''
        if (!isActiveQuery()) return
        setFinalBanner({ text: bannerText || "Here's what I put together for you.", vibe: generation.outfit.style || '' })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !isActiveQuery()) return

        const { data: inserted } = await insertGeneratedOutfitBatch(generation.outfit, {
          primaryImageUrl: generation.image_url,
          alternativeImageUrl: generation.alternative_image_url,
        })

        if (isActiveQuery() && inserted?.length) {
          const ids: { primary?: string; alternative?: string } = { primary: inserted[0]?.id }
          if (inserted[1]) ids.alternative = inserted[1].id
          generatedIdsRef.current = ids
          setGeneratedIds(ids)
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
    allOutfits,
    allOutfitsRef,
    curateTriggered,
    displayName,
    getOutfitGender,
    isNaturalQuery,
    searchQuery,
    serializedOutfits,
    userBodyShape,
    userGender,
    userHeight,
    userSkinTone,
    userStylePref,
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
