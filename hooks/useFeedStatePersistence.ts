'use client'

import { useEffect } from 'react'
import type { ReadonlyURLSearchParams } from 'next/navigation'

interface FeedStatePersistenceParams<TAiContext, TGeneratedOutfit> {
  aiContext: TAiContext | null
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  finalBanner: { text: string; vibe: string; colors?: Array<{ hex: string; name: string }> } | null
  generatedIds: { primary?: string; alternative?: string }
  generatedOutfit: TGeneratedOutfit | null
  inputValue: string
  searchParams: ReadonlyURLSearchParams | null
  searchQuery: string
  setAiContext: (value: TAiContext) => void
  setChatHistory: (value: Array<{ role: 'user' | 'assistant'; content: string }>) => void
  setFinalBanner: (value: { text: string; vibe: string; colors?: Array<{ hex: string; name: string }> }) => void
  setGeneratedIds: (value: { primary?: string; alternative?: string }) => void
  setGeneratedOutfit: (value: TGeneratedOutfit) => void
  setInputValue: (value: string) => void
  setSearchQuery: (value: string) => void
}

const FEED_STATE_KEY = 'elephante_feed_state'

export function useFeedStatePersistence<TAiContext, TGeneratedOutfit>({
  aiContext,
  chatHistory,
  finalBanner,
  generatedIds,
  generatedOutfit,
  inputValue,
  searchParams,
  searchQuery,
  setAiContext,
  setChatHistory,
  setFinalBanner,
  setGeneratedIds,
  setGeneratedOutfit,
  setInputValue,
  setSearchQuery,
}: FeedStatePersistenceParams<TAiContext, TGeneratedOutfit>) {
  const saveFeedState = () => {
    if (!searchQuery) return

    try {
      sessionStorage.setItem(FEED_STATE_KEY, JSON.stringify({
        searchQuery,
        aiContext,
        chatHistory,
        finalBanner,
        generatedIds,
        generatedOutfit,
        inputValue,
      }))
    } catch {}
  }

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(FEED_STATE_KEY)
      if (!saved) return

      const state = JSON.parse(saved)
      if (!state || typeof state !== 'object' || typeof state.searchQuery !== 'string') return
      const urlQuery = searchParams?.get('q') || ''
      if (state.searchQuery && state.searchQuery === urlQuery) {
        setSearchQuery(state.searchQuery)
        setInputValue(typeof state.inputValue === 'string' ? state.inputValue : state.searchQuery)
        if (state.aiContext) setAiContext(state.aiContext)
        if (Array.isArray(state.chatHistory)) setChatHistory(state.chatHistory)
        if (state.finalBanner) setFinalBanner(state.finalBanner)
        if (state.generatedIds && typeof state.generatedIds === 'object') setGeneratedIds(state.generatedIds)
        if (state.generatedOutfit) setGeneratedOutfit(state.generatedOutfit)
      }

      sessionStorage.removeItem(FEED_STATE_KEY)
    } catch {}
  }, [searchParams, setAiContext, setChatHistory, setFinalBanner, setGeneratedIds, setGeneratedOutfit, setInputValue, setSearchQuery])

  return { saveFeedState }
}
