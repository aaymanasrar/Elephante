'use client'

import { useEffect } from 'react'

export interface PersistedFeedState<TAiContext, TGeneratedOutfit> {
  aiContext: TAiContext | null
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  finalBanner: { text: string; vibe: string; colors?: Array<{ hex: string; name: string }> } | null
  generatedIds: { primary?: string; alternative?: string }
  generatedOutfit: TGeneratedOutfit | null
  inputValue: string
  searchQuery: string
}

interface FeedStatePersistenceParams<TAiContext, TGeneratedOutfit> {
  aiContext: TAiContext | null
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  finalBanner: { text: string; vibe: string; colors?: Array<{ hex: string; name: string }> } | null
  generatedIds: { primary?: string; alternative?: string }
  generatedOutfit: TGeneratedOutfit | null
  inputValue: string
  searchQuery: string
}

export const FEED_STATE_KEY = 'elephante_feed_state'
export const FEED_LAST_URL_KEY = 'elephante_last_feed_url'

function isPersistedFeedState<TAiContext, TGeneratedOutfit>(state: unknown): state is PersistedFeedState<TAiContext, TGeneratedOutfit> {
  return Boolean(state && typeof state === 'object' && typeof (state as { searchQuery?: unknown }).searchQuery === 'string')
}

function normalizeChatHistory(history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined) {
  if (!Array.isArray(history)) return []

  return history.reduce<Array<{ role: 'user' | 'assistant'; content: string }>>((turns, turn) => {
    if (!turn || (turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.content !== 'string') return turns

    const previous = turns[turns.length - 1]
    const previousPair = turns[turns.length - 2]
    if (previous?.role === turn.role && previous.content === turn.content) return turns
    if (previousPair?.role === turn.role && previousPair.content === turn.content) return turns

    turns.push(turn)
    return turns
  }, [])
}

export function readFeedStateForQuery<TAiContext, TGeneratedOutfit>(query: string) {
  if (typeof window === 'undefined' || !query) return null

  try {
    const saved = localStorage.getItem(FEED_STATE_KEY) || sessionStorage.getItem(FEED_STATE_KEY)
    if (!saved) return null

    const state: unknown = JSON.parse(saved)
    if (!isPersistedFeedState<TAiContext, TGeneratedOutfit>(state)) return null
    return state.searchQuery === query
      ? { ...state, chatHistory: normalizeChatHistory(state.chatHistory) }
      : null
  } catch {
    return null
  }
}

function writeFeedState<TAiContext, TGeneratedOutfit>(state: PersistedFeedState<TAiContext, TGeneratedOutfit>) {
  try {
    const serialized = JSON.stringify(state)
    localStorage.setItem(FEED_STATE_KEY, serialized)
    sessionStorage.setItem(FEED_STATE_KEY, serialized)
  } catch {}
}

export function readLastFeedUrl() {
  if (typeof window === 'undefined') return ''

  try {
    const url = localStorage.getItem(FEED_LAST_URL_KEY) || ''
    return url.startsWith('/feed') ? url : ''
  } catch {
    return ''
  }
}

export function writeLastFeedUrl(url: string) {
  if (typeof window === 'undefined' || !url.startsWith('/feed')) return

  try {
    localStorage.setItem(FEED_LAST_URL_KEY, url)
  } catch {}
}

export function useFeedStatePersistence<TAiContext, TGeneratedOutfit>({
  aiContext,
  chatHistory,
  finalBanner,
  generatedIds,
  generatedOutfit,
  inputValue,
  searchQuery,
}: FeedStatePersistenceParams<TAiContext, TGeneratedOutfit>) {
  const saveFeedState = () => {
    if (!searchQuery) return

    writeFeedState({
      searchQuery,
      aiContext,
      chatHistory: normalizeChatHistory(chatHistory),
      finalBanner,
      generatedIds,
      generatedOutfit,
      inputValue,
    })
  }

  useEffect(() => {
    if (!searchQuery) {
      return
    }

    if (!aiContext && chatHistory.length === 0 && !finalBanner && !generatedOutfit) return

    writeFeedState({
      searchQuery,
      aiContext,
      chatHistory: normalizeChatHistory(chatHistory),
      finalBanner,
      generatedIds,
      generatedOutfit,
      inputValue,
    })
  }, [aiContext, chatHistory, finalBanner, generatedIds, generatedOutfit, inputValue, searchQuery])

  return { saveFeedState }
}
