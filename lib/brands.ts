import { getBrandShopLink, detectBrandInText, type Gender } from '@/lib/affiliates'

const AESTHETIC_MAP = {
  neutral: { label: 'Neutral', swatches: ['#f5f0dc', '#d2b48c', '#ffffff'] },
  dark: { label: 'Dark / Moody', swatches: ['#111111', '#2f4f4f', '#1b2a4a'] },
  pastel: { label: 'Soft / Pastel', swatches: ['#ffb6c1', '#add8e6', '#e6e6fa'] },
  colorful: { label: 'Vibrant', swatches: ['#ff4500', '#32cd32', '#ffd700'] },
  classic: { label: 'Classic', swatches: ['#1a1a1a', '#d4af37', '#f5f5f5'] },
} as const

type AestheticValue = {
  label: string
  swatches: readonly string[]
}

function normalizeText(value?: string | null) {
  return (value || '').toLowerCase()
}

export function getAesthetic(colorScheme?: string | null, aesthetic?: string | null): AestheticValue | null {
  const source = `${normalizeText(colorScheme)} ${normalizeText(aesthetic)}`

  if (source.includes('pastel') || source.includes('soft')) return AESTHETIC_MAP.pastel
  if (source.includes('dark') || source.includes('moody') || source.includes('midnight')) return AESTHETIC_MAP.dark
  if (source.includes('color') || source.includes('vibrant')) return AESTHETIC_MAP.colorful
  if (source.includes('neutral') || source.includes('beige') || source.includes('camel')) return AESTHETIC_MAP.neutral
  if (source.includes('classic')) return AESTHETIC_MAP.classic

  return null
}

function inferGender(piece: string, brand: string | null): Gender {
  const combined = `${piece} ${brand || ''}`.toLowerCase()
  if (combined.includes('dress') || combined.includes('heels') || combined.includes('abaya')) return 'female'
  return 'male'
}

export function detectPieceBrand(piece: string, brand: string | null, perPieceBrand?: string | null) {
  // Priority: explicit per-piece brand → text detection → outfit-level brand
  const resolved = perPieceBrand || detectBrandInText(piece) || brand
  if (!resolved) return null

  const link = getBrandShopLink(resolved, piece, inferGender(piece, resolved))
  if (!link) return null

  return {
    brand: link.label,
    url: link.url,
  }
}
