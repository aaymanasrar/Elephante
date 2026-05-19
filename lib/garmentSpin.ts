import { optionalEnv } from '@/lib/env'
import type { Outfit } from '@/types/outfit'

export type GarmentSpinView = {
  id: string
  label: string
  prompt: string
}

export type GarmentSpinFrame = {
  id: string
  label: string
  image_url: string
  provider: string
}

export const GARMENT_SPIN_VIEWS: GarmentSpinView[] = [
  { id: 'front', label: 'Front', prompt: 'straight-on front view' },
  { id: 'front-right', label: 'Front 45', prompt: 'front three-quarter view turned 45 degrees to the right' },
  { id: 'right', label: 'Right', prompt: 'right side profile view' },
  { id: 'back-right', label: 'Back 45', prompt: 'back three-quarter view turned 45 degrees to the right' },
  { id: 'back', label: 'Back', prompt: 'straight-on back view' },
  { id: 'back-left', label: 'Back 45', prompt: 'back three-quarter view turned 45 degrees to the left' },
  { id: 'left', label: 'Left', prompt: 'left side profile view' },
  { id: 'front-left', label: 'Front 45', prompt: 'front three-quarter view turned 45 degrees to the left' },
]

function normalizePiece(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'null') return null
  return trimmed
}

function normalizeColors(colors: Outfit['hex_colors'] | Outfit['colors']) {
  if (Array.isArray(colors)) return colors.map((value) => String(value).trim()).filter(Boolean).join(', ')
  return normalizePiece(typeof colors === 'string' ? colors : null)
}

export function garmentSpinSignature(outfit: Outfit) {
  return [
    outfit.style_category,
    outfit.outfit_name,
    outfit.style,
    outfit.color_scheme,
    outfit.top_wear || outfit.top,
    outfit.bottom_wear,
    outfit.shoes,
    outfit.accessories,
    outfit.outerwear,
  ].map((value) => normalizePiece(value) || '').join('|')
}

export function seedFromString(value: string): number {
  return Math.abs([...value].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)) % 2147483647
}

export function buildGarmentSpinPrompt(outfit: Outfit, view: GarmentSpinView) {
  const pieces = [
    outfit.top_wear || outfit.top,
    outfit.bottom_wear,
    outfit.shoes,
    outfit.accessories,
    outfit.outerwear,
  ].map(normalizePiece).filter((piece): piece is string => Boolean(piece))
  const colorText = normalizeColors(outfit.hex_colors || outfit.colors)

  return [
    'Isolated fashion garment product render for a 360 spin viewer',
    `view angle: ${view.prompt}`,
    pieces.length ? `same outfit garments: ${pieces.join(', ')}` : null,
    normalizePiece(outfit.style_category || outfit.outfit_name || outfit.style) ? `style: ${normalizePiece(outfit.style_category || outfit.outfit_name || outfit.style)}` : null,
    normalizePiece(outfit.color_scheme) ? `palette: ${normalizePiece(outfit.color_scheme)}` : null,
    colorText ? `key colors: ${colorText}` : null,
    'ghost mannequin effect with clothing holding natural human-shaped volume, but the mannequin/body is completely invisible',
    'garments only, no visible mannequin, no body, no face, no skin, no hair, no hanger, no stand',
    'transparent PNG alpha background, no background image, no studio room, no floor, no shadow',
    'centered full outfit from neck area to shoes, consistent scale across all angles',
    'infer unseen side or back details conservatively from the visible garment type; do not add logos or redesign',
    'crisp fabric texture, clean retail e-commerce asset, no text, no watermark',
  ].filter(Boolean).join('. ')
}

export function garmentSpinImageUrl(prompt: string, seed: number) {
  const token = optionalEnv('POLLINATIONS_TOKEN')
  const params = new URLSearchParams({
    width: '768',
    height: '1024',
    nologo: 'true',
    model: 'flux',
    seed: String(seed),
    ...(token ? { token } : {}),
  })
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`
}

export function buildGarmentSpinFrames(outfit: Outfit, outfitId: string | number, frameCount = GARMENT_SPIN_VIEWS.length): GarmentSpinFrame[] {
  const signature = garmentSpinSignature(outfit)
  return GARMENT_SPIN_VIEWS.slice(0, Math.max(1, Math.min(GARMENT_SPIN_VIEWS.length, frameCount))).map((view) => {
    const prompt = buildGarmentSpinPrompt(outfit, view)
    return {
      id: view.id,
      label: view.label,
      image_url: garmentSpinImageUrl(prompt, seedFromString(`${outfitId}-${view.id}-${signature}`)),
      provider: 'pollinations-spin',
    }
  })
}
