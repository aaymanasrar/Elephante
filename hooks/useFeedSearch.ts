'use client'

import { useCallback, useState } from 'react'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { insertGeneratedOutfit } from '@/services/outfitService'
import { useAiSearchFlow, type AiContext } from '@/hooks/useAiSearchFlow'
import { readFeedStateForQuery, useFeedStatePersistence } from '@/hooks/useFeedStatePersistence'
import { useSearchQueryUrlSync } from '@/hooks/useFeedUi'
import type { WeatherContext } from '@/services/feedSearchApi'
import type { GeneratedOutfitResult } from '@/types/outfit'

interface FeedSearchParams {
  displayName: string
  initialQuery: string
  isNaturalQuery: (query: string) => boolean
  onNavigateToLogin: () => void
  onNavigateToOutfit: (id: string) => void
  replaceUrl: (url: string) => void
  searchParams: ReadonlyURLSearchParams | null
  userBodyShape: string
  userGender: string
  userHeight: string
  userSkinTone: string
  userStylePref: string
  userAvatarUrl?: string
  language?: 'en' | 'ar'
  weather?: WeatherContext | null
  ready?: boolean
}

export function useFeedSearch({
  displayName,
  initialQuery,
  isNaturalQuery,
  onNavigateToLogin,
  onNavigateToOutfit,
  replaceUrl,
  searchParams,
  userBodyShape,
  userGender,
  userHeight,
  userSkinTone,
  userStylePref,
  userAvatarUrl = '',
  language = 'en',
  weather = null,
  ready = true,
}: FeedSearchParams) {
  const restoredState = useState(() => readFeedStateForQuery<AiContext, GeneratedOutfitResult>(initialQuery))[0]
  const [searchQuery, setSearchQueryState] = useState(restoredState?.searchQuery || initialQuery)
  const [inputValue, setInputValue] = useState(restoredState != null ? restoredState.inputValue : initialQuery)
  const [curateTriggered, setCurateTriggered] = useState(false)
  const {
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
  } = useAiSearchFlow({
    curateTriggered,
    displayName,
    isNaturalQuery,
    searchQuery,
    userBodyShape,
    userGender,
    userHeight,
    userSkinTone,
    userStylePref,
    userAvatarUrl,
    weather,
    initialAiContext: restoredState?.aiContext || null,
    initialChatHistory: restoredState?.chatHistory || [],
    initialCompletedQuery: restoredState?.searchQuery || '',
    initialFinalBanner: restoredState?.finalBanner || null,
    initialGeneratedIds: restoredState?.generatedIds || {},
    initialGeneratedOutfit: restoredState?.generatedOutfit || null,
    language,
    ready,
  })
  const setSearchQuery = useCallback((value: string) => {
    if (value !== searchQuery) setCurateTriggered(false)
    setSearchQueryState(value)
  }, [searchQuery])
  const { saveFeedState } = useFeedStatePersistence({
    aiContext,
    chatHistory,
    finalBanner,
    generatedIds,
    generatedOutfit,
    inputValue,
    searchQuery,
  })

  useSearchQueryUrlSync(searchQuery, searchParams, replaceUrl)

  const handleGeneratedTap = async (type: 'primary' | 'alternative') => {
    if (!generatedOutfit) return

    const existingId = generatedIdsRef.current[type]
    if (existingId) {
      saveFeedState()
      onNavigateToOutfit(existingId)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        onNavigateToLogin()
        return
      }

      const isAlternative = type === 'alternative'
      const outfit = isAlternative ? generatedOutfit.outfit?.alternative : generatedOutfit.outfit
      const primaryOutfit = generatedOutfit.outfit || {}
      const imageUrl = isAlternative ? generatedOutfit.alternative_image_url : generatedOutfit.image_url

      const { data: inserted } = await insertGeneratedOutfit(outfit, {
        type,
        primaryOutfit,
        imageUrl,
      })

      if (inserted?.id) {
        generatedIdsRef.current = { ...generatedIdsRef.current, [type]: inserted.id }
        setGeneratedIds((prev) => ({ ...prev, [type]: inserted.id }))
        setGeneratedOutfit((previous) => {
          if (!previous || !inserted.image_url) return previous
          return isAlternative
            ? { ...previous, alternative_image_url: inserted.image_url }
            : { ...previous, image_url: inserted.image_url }
        })
        saveFeedState()
        onNavigateToOutfit(inserted.id)
      }
    } catch {}
  }

  const buildFollowUpPrompt = (chip: string) => {
    const baseIntent = (aiContext?.intent || searchQuery || inputValue).trim()
    const lowerBase = baseIntent.toLowerCase()
    const isAr = language === 'ar'
    const followUpUserCount = chatHistory.filter((turn) => turn.role === 'user').length
    const requestedCards = Math.max(1, 3 - Math.max(0, followUpUserCount - 1))
    const cardHint = requestedCards === 1
      ? (isAr ? 'أرني بطاقة إطلالة واحدة.' : 'Show me 1 outfit card.')
      : (isAr ? `أرني ${requestedCards} بطاقات إطلالة.` : `Show me ${requestedCards} outfit cards.`)

    switch (chip) {
      case 'More formal': return `${cardHint} I want a more formal version of ${lowerBase}.`
      case 'More casual': return `${cardHint} I want a more casual version of ${lowerBase}.`
      case 'Different colours': return `${cardHint} Show me the same idea as ${lowerBase}, but in different colors.`
      case 'Summer version': return `${cardHint} Give me a summer version of ${lowerBase}.`
      case 'Night out version': return `${cardHint} Give me a night out version of ${lowerBase}.`
      case 'Smart Casual': return `${cardHint} ${lowerBase} — show me smart casual outfit options.`
      case 'Formal / Work': return `${cardHint} ${lowerBase} — I need formal or work-appropriate outfit options.`
      case 'Weekend Casual': return `${cardHint} ${lowerBase} — give me casual weekend outfit ideas.`
      case 'Night Out': return `${cardHint} ${lowerBase} — make it a night out look.`
      case 'Summer Look': return `${cardHint} ${lowerBase} — show me summer outfit options.`
      default: return `${chip} ${cardHint}`
    }
  }

  const triggerCuration = useCallback(() => {
    lastGeneratedForRef.current = ''
    setCurateTriggered(true)
  }, [lastGeneratedForRef])

  const clearActiveSearchState = useCallback(() => {
    setAiContext(null)
    setChatHistory([])
    setCurateTriggered(false)
    setFinalBanner(null)
    setGeneratedOutfit(null)
    setGeneratingOutfit(false)
    setGeneratedIds({})
  }, [setAiContext, setChatHistory, setFinalBanner, setGeneratedOutfit, setGeneratingOutfit, setGeneratedIds])

  return {
    aiContext,
    aiStatus,
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
    isSearching: searchQuery.trim().length > 0 && (
      isThinking ||
      generatingOutfit ||
      aiContext !== null ||
      finalBanner !== null ||
      generatedOutfit !== null ||
      searchQuery.trim() === inputValue.trim()
    ),
    isThinking,
    saveFeedState,
    searchQuery,
    setChatHistory,
    setInputValue,
    setSearchQuery,
    triggerCuration,
    setAiContext,
    setFinalBanner,
    setGeneratedOutfit,
    setGeneratedIds,
  }
}
