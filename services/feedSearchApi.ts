'use client'

export interface WeatherContext {
  city: string
  temperature_c: number
  condition: string
  wind_kph?: number
}

interface OutfitSearchParams {
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  displayName: string
  query: string
  userBodyShape: string
  userGender: string
  userHeight: string
  userSkinTone: string
  userStylePref: string
  language?: 'en' | 'ar'
  weather?: WeatherContext | null
}

interface OutfitGenerationParams {
  query: string
  userBodyShape: string
  userGender: string
  userHeight: string
  userSkinTone: string
  userStylePref: string
  avatar_url?: string
  language?: 'en' | 'ar'
  weather?: WeatherContext | null
}

export async function requestOutfitSearch({
  chatHistory,
  displayName,
  query,
  userBodyShape,
  userGender,
  userHeight,
  userSkinTone,
  userStylePref,
  language,
  weather,
}: OutfitSearchParams, signal: AbortSignal) {
  const response = await fetch('/api/outfit-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      query,
      name: displayName,
      gender: userGender,
      skin_tone: userSkinTone,
      body_shape: userBodyShape,
      height: userHeight,
      style_pref: userStylePref,
      history: chatHistory,
      language,
      weather,
    }),
  })
  const data = await response.json().catch((err) => {
    console.warn('[feedSearchApi] requestOutfitSearch JSON parse failed:', err)
    return { error: 'Failed to parse response from outfit-search' }
  })
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `outfit-search failed (${response.status})`)
  }
  return data
}

export async function requestOutfitGeneration({
  query,
  userBodyShape,
  userGender,
  userHeight,
  userSkinTone,
  userStylePref,
  avatar_url,
  language,
  weather,
}: OutfitGenerationParams, signal: AbortSignal) {
  const response = await fetch('/api/outfit-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      query,
      gender: userGender,
      skin_tone: userSkinTone,
      body_shape: userBodyShape,
      height: userHeight,
      style_pref: userStylePref,
      avatar_url,
      language,
      weather,
    }),
  })
  const data = await response.json().catch((err) => {
    console.warn('[feedSearchApi] requestOutfitGeneration JSON parse failed:', err)
    return { error: 'Failed to parse response from outfit-generate' }
  })
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `outfit-generate failed (${response.status})`)
  }
  return data
}
