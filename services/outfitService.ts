import { supabase } from '@/lib/supabase'
import type { GeneratedOutfitVariant } from '@/types/outfit'

interface AiStylistOutfitLike {
  outfit_name?: string
  style?: string
  color_scheme?: string
  occasion?: string
  why_it_works?: string
  styling_tip?: string
  key_colors?: string[]
  pieces?: {
    top?: { item?: string | null }
    bottom?: { item?: string | null }
    shoes?: { item?: string | null }
    outerwear?: { item?: string | null } | null
    accessories?: { item?: string | null }
  }
}

function normalizeOptionalText(value?: string | null) {
  return value && value !== 'None' && value !== 'null' ? value : null
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}
}

async function saveGeneratedOutfits(body: Record<string, unknown>) {
  const response = await fetch('/api/generated-outfits/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...await authHeaders(),
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch((err) => {
    console.warn('[outfitService] saveGeneratedOutfits JSON parse failed:', err)
    return { error: 'Failed to parse response from save outfit' }
  })
  if (!response.ok) {
    return {
      saved: [],
      error: new Error(typeof data?.error === 'string' ? data.error : `generated outfit save failed (${response.status})`),
    }
  }

  return {
    saved: Array.isArray(data?.saved) ? data.saved : [],
    error: null,
  }
}

function toGeneratedVariant(outfit: AiStylistOutfitLike, gender?: string | null): GeneratedOutfitVariant {
  return {
    outfit_name: outfit.outfit_name || outfit.style || 'Styled Look',
    style: outfit.style || null,
    color_scheme: outfit.color_scheme || '',
    top_wear: outfit.pieces?.top?.item || null,
    bottom_wear: outfit.pieces?.bottom?.item || null,
    shoes: outfit.pieces?.shoes?.item || null,
    outerwear: normalizeOptionalText(outfit.pieces?.outerwear?.item),
    accessories: normalizeOptionalText(outfit.pieces?.accessories?.item),
    occasions: outfit.occasion || null,
    outfit_details: [outfit.why_it_works, outfit.styling_tip].filter(Boolean).join('\n\n') || null,
    key_colors: outfit.key_colors || null,
    gender: gender || 'male',
  }
}

export async function insertGeneratedOutfit(generated: GeneratedOutfitVariant | null | undefined, options: {
  type: 'primary' | 'alternative'
  primaryOutfit: GeneratedOutfitVariant | null | undefined
  imageUrl: string | null | undefined
}) {
  if (!generated) {
    return {
      data: null,
      error: new Error('Cannot insert an empty generated outfit.'),
    }
  }

  const { saved, error } = await saveGeneratedOutfits({
    type: options.type,
    outfit: generated,
    primaryOutfit: options.primaryOutfit ?? generated,
    image_url: options.imageUrl,
  })

  return {
    data: saved[0] ? { id: saved[0].id, image_url: saved[0].image_url } : null,
    error,
  }
}

export async function insertGeneratedOutfitBatch(primaryOutfit: GeneratedOutfitVariant & { alternative?: GeneratedOutfitVariant | null }, options: {
  primaryImageUrl: string | null | undefined
  alternativeImageUrl?: string | null | undefined
}) {
  const { saved, error } = await saveGeneratedOutfits({
    outfit: primaryOutfit,
    image_url: options.primaryImageUrl,
    alternative_image_url: options.alternativeImageUrl,
  })

  return {
    data: saved.map((item: { id: string; image_url?: string | null }) => ({ id: item.id, image_url: item.image_url || null })),
    error,
  }
}

export async function saveAiStylistOutfit(outfit: AiStylistOutfitLike, _userId: string, gender?: string | null, imageUrl?: string | null) {
  const { saved, error } = await saveGeneratedOutfits({
    type: 'primary',
    outfit: toGeneratedVariant(outfit, gender),
    image_url: imageUrl || null,
  })

  return {
    inserted: saved[0] ? { id: saved[0].id } : null,
    error,
  }
}
