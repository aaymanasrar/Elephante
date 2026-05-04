import type { Outfit } from '@/types/outfit'

export const SCHEME_KEYWORDS: Record<string, string[]> = {
  neutral: ['beige', 'camel', 'cream', 'off-white', 'stone', 'tan', 'grey', 'gray', 'white', 'khaki'],
  dark: ['black', 'charcoal', 'navy', 'dark', 'indigo', 'midnight'],
  pastel: ['pastel', 'light blue', 'sky blue', 'lavender', 'pink', 'soft', 'sage'],
  colorful: ['vibrant', 'green', 'red', 'yellow', 'orange', 'burgundy', 'colorful'],
}

export function matchesAesthetic(outfit: Outfit, aesthetic: string) {
  const scheme = (outfit.color_scheme || outfit.color_scheme || '').toLowerCase()
  const keywords = SCHEME_KEYWORDS[aesthetic] || []
  return keywords.some((keyword) => scheme.includes(keyword))
}

export function matchesSearch(outfit: Outfit, query: string) {
  const normalized = query.toLowerCase().trim()
  if (!normalized) return true

  const parts = normalized.split(/\s+/)
  const blob = [
    outfit.outfit_name,
    outfit.style_category,
    outfit.style,
    outfit.color_scheme,
    outfit.top_wear,
    outfit.top,
    outfit.bottom_wear,
    outfit.shoes,
    outfit.accessories,
    outfit.outerwear,
    outfit.occasions,
    outfit.when_to_wear,
    outfit.outfit_details,
    outfit.material_notes,
  ].filter(Boolean).join(' ').toLowerCase()

  const expanded = blob
    + ((blob.includes('office') || blob.includes('business')) ? ' work meeting corporate' : '')
    + ((blob.includes('wedding') || blob.includes('gala')) ? ' formal event celebration' : '')
    + (blob.includes('thobe') ? ' traditional saudi arab' : '')
    + (blob.includes('casual') ? ' relaxed weekend everyday' : '')

  return parts.every((part) => expanded.includes(part))
}

interface FilterOutfitsParams {
  outfits: Outfit[]
  activeLifestyles: string[]
  activeAesthetics: string[]
  searchQuery: string
  userPalette: string[]
}

export function filterOutfits({
  outfits,
  activeLifestyles,
  activeAesthetics,
  searchQuery,
  userPalette,
}: FilterOutfitsParams) {
  let result = [...outfits]

  if (activeLifestyles.length > 0) {
    result = result.filter((outfit) =>
      activeLifestyles.some((lifestyle) =>
        (outfit.style_category || outfit.style || '').toLowerCase().includes(lifestyle.toLowerCase())
      )
    )
  }

  if (activeAesthetics.length > 0) {
    result = result.filter((outfit) =>
      activeAesthetics.some((aesthetic) => matchesAesthetic(outfit, aesthetic))
    )
  }

  if (searchQuery.trim()) {
    result = result.filter((outfit) => matchesSearch(outfit, searchQuery))
  }

  if (userPalette.length > 0) {
    result.sort((a, b) => {
      const aMatch = userPalette.some((palette) => matchesAesthetic(a, palette)) ? 0 : 1
      const bMatch = userPalette.some((palette) => matchesAesthetic(b, palette)) ? 0 : 1
      return aMatch - bMatch
    })
  }

  return result
}
