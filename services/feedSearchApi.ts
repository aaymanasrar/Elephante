'use client'

interface OutfitSearchParams {
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  displayName: string
  serializedOutfits: Array<Record<string, unknown>>
  query: string
  userBodyShape: string
  userGender: string
  userHeight: string
  userSkinTone: string
  userStylePref: string
}

interface OutfitGenerationParams {
  query: string
  userBodyShape: string
  userGender: string
  userHeight: string
  userSkinTone: string
  userStylePref: string
}

export async function requestOutfitSearch({
  chatHistory,
  displayName,
  query,
  serializedOutfits,
  userBodyShape,
  userGender,
  userHeight,
  userSkinTone,
  userStylePref,
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
      outfits: serializedOutfits,
    }),
  })
  if (!response.ok) throw new Error(`outfit-search failed (${response.status})`)
  return response.json()
}

export async function requestOutfitGeneration({
  query,
  userBodyShape,
  userGender,
  userHeight,
  userSkinTone,
  userStylePref,
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
    }),
  })
  if (!response.ok) throw new Error(`outfit-generate failed (${response.status})`)
  return response.json()
}
