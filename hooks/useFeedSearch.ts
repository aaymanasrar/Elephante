'use client'

import type { MutableRefObject } from 'react'
import { useState } from 'react'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { insertGeneratedOutfit } from '@/services/outfitService'
import { useAiSearchFlow, type AiContext } from '@/hooks/useAiSearchFlow'
import { readFeedStateForQuery, useFeedStatePersistence } from '@/hooks/useFeedStatePersistence'
import { useSearchQueryUrlSync } from '@/hooks/useFeedUi'
import type { GeneratedOutfitResult, Outfit } from '@/types/outfit'

interface FeedSearchParams {
  allOutfits: Outfit[]
  allOutfitsRef: MutableRefObject<Outfit[]>
  displayName: string
  getOutfitGender: (outfit: Outfit) => 'male' | 'female' | 'unisex'
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
  ready?: boolean
}

export function useFeedSearch({
  allOutfits,
  allOutfitsRef,
  displayName,
  getOutfitGender,
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
  ready = true,
}: FeedSearchParams) {
  const restoredState = useState(() => readFeedStateForQuery<AiContext, GeneratedOutfitResult>(initialQuery))[0]
  const [searchQuery, setSearchQueryState] = useState(restoredState?.searchQuery || initialQuery)
  const [inputValue, setInputValue] = useState(restoredState?.inputValue || initialQuery)
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
    userAvatarUrl,
    initialAiContext: restoredState?.aiContext || null,
    initialChatHistory: restoredState?.chatHistory || [],
    initialCompletedQuery: restoredState?.searchQuery || '',
    initialFinalBanner: restoredState?.finalBanner || null,
    initialGeneratedIds: restoredState?.generatedIds || {},
    initialGeneratedOutfit: restoredState?.generatedOutfit || null,
    language,
    ready,
  })
  const setSearchQuery = (value: string) => {
    if (value !== searchQuery) setCurateTriggered(false)
    setSearchQueryState(value)
  }
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

    switch (chip) {
      case 'More formal':
        return `I want a more formal version of ${lowerBase}.`
      case 'More casual':
        return `I want a more casual version of ${lowerBase}.`
      case 'Different colours':
        return `Show me the same idea as ${lowerBase}, but in different colors.`
      case 'Summer version':
        return `Give me a summer version of ${lowerBase}.`
      case 'Night out version':
        return `Give me a night out version of ${lowerBase}.`
      case 'Smart Casual':
        return `${lowerBase} — show me smart casual outfit options.`
      case 'Formal / Work':
        return `${lowerBase} — I need formal or work-appropriate outfit options.`
      case 'Weekend Casual':
        return `${lowerBase} — give me casual weekend outfit ideas.`
      case 'Night Out':
        return `${lowerBase} — make it a night out look.`
      case 'Summer Look':
        return `${lowerBase} — show me summer outfit options.`
      default:
        return chip
    }
  }

  const triggerCuration = () => {
    lastGeneratedForRef.current = ''
    setCurateTriggered(true)
  }

  const clearActiveSearchState = () => {
    setAiContext(null)
    setChatHistory([])
    setCurateTriggered(false)
    setFinalBanner(null)
    setGeneratedOutfit(null)
    setGeneratingOutfit(false)
    setGeneratedIds({})
  }

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
  }
}
