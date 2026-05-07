import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithFallback, extractJSON } from '@/services/aiProviders'

interface AnalysisPayload {
  outfit_name: string
  style: string
  vibe: string
  color_scheme: string
  occasions: string[]
  pieces: string[]
  color_names: string[]
  key_colors: string[]
  why_it_works: string
  styling_tip: string
  match_score: number | null
  skin_tone_feedback: string
  overall_verdict: string
}

type AnalysisMode = 'inventory' | 'rating'

const VISION_PROMPT = `You are Elephante's AI Stylist. Analyse the attached outfit image(s) and return ONLY a raw JSON object (no markdown, no code blocks) with this exact structure:
{
  "outfit_name": "short catchy name for the look",
  "style": "style category e.g. Smart Casual, Business Casual, Formal, Streetwear",
  "vibe": "3 words max",
  "color_scheme": "1 sentence describing the palette",
  "occasions": ["occasion1", "occasion2"],
  "pieces": ["top garment description", "bottom garment description", "shoes description", "accessories or null", "outerwear or null"],
  "color_names": ["ColorName1", "ColorName2", "ColorName3"],
  "key_colors": ["#hex1", "#hex2", "#hex3"],
  "why_it_works": "2 sentences about why this outfit works stylistically",
  "styling_tip": "one actionable tip to elevate the look",
  "match_score": 85,
  "skin_tone_feedback": "Detailed feedback on how these colors complement the user's skin tone",
  "overall_verdict": "A summary verdict on the overall look"
}
For pieces: always 5 strings in order [top, bottom, shoes, accessories, outerwear]. Use null string if a piece is not visible.
For color_names: simple English color names like Navy, White, Tan, Charcoal etc.
Match score should be between 0 and 100.

Judge two things clearly:
1. Skin-tone harmony: whether the palette flatters the user's skin tone, creates good contrast, or washes them out.
2. Overall outfit cohesion: silhouette, proportions, color balance, formality, and whether the pieces feel intentional together.
Be honest and specific, but never insulting. If the user's skin tone is not provided, say that skin-tone feedback is limited and focus on the visible palette.`

const INVENTORY_PROMPT = `You are Elephante's visual fashion analyst. Identify what is visible in the attached clothing or outfit image and return ONLY a raw JSON object (no markdown, no code blocks) with this exact structure:
{
  "outfit_name": "short descriptive name for what is visible",
  "style": "style category if inferable, otherwise Clothing Analysis",
  "vibe": "3 words max",
  "color_scheme": "1 sentence describing the visible palette",
  "occasions": ["occasion1", "occasion2"],
  "pieces": ["top garment description", "bottom garment description", "shoes description", "accessories or null", "outerwear or null"],
  "color_names": ["ColorName1", "ColorName2", "ColorName3"],
  "key_colors": ["#hex1", "#hex2", "#hex3"],
  "why_it_works": "1 sentence describing the visible styling or item logic without rating it",
  "styling_tip": "one neutral styling possibility based on the visible items",
  "match_score": null,
  "skin_tone_feedback": "Do not rate skin-tone fit yet. If skin is visible, briefly name that rating can consider contrast later; otherwise say skin tone is not visible.",
  "overall_verdict": "A concise inventory summary of what is visible, not a judgement"
}
For pieces: always 5 strings in order [top, bottom, shoes, accessories, outerwear]. Use null string if a piece is not visible.
Do not score or judge the outfit in this mode. Focus on what is there: garments, colors, silhouette, and visible styling details.`

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim())))
}

function getImageUrls(body: Record<string, unknown>) {
  const imageUrls = Array.isArray(body.image_urls) ? body.image_urls : []
  return uniqueStrings([
    body.image_url,
    body.secondary_image_url,
    ...imageUrls,
  ])
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

function clampScore(value: unknown) {
  const score = typeof value === 'string'
    ? Number(value.match(/-?\d+(?:\.\d+)?/)?.[0])
    : Number(value)
  if (!Number.isFinite(score)) return 70
  return Math.max(0, Math.min(100, Math.round(score)))
}

function compactModelText(raw: string) {
  return raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim()
    .slice(0, 600)
}

function normalizeAnalysis(parsed: Record<string, unknown>, fallbackText: string, skinTone: string, mode: AnalysisMode): AnalysisPayload {
  const overallFallback = compactModelText(fallbackText) || 'The outfit has been reviewed for color harmony, proportion, and overall cohesion.'
  const limitedSkinTone = skinTone
    ? `For ${skinTone.replace(/_/g, ' ')}, the palette should be judged by contrast, warmth, and whether the colors brighten the complexion.`
    : 'Skin-tone feedback is limited because no skin tone was provided.'
  const pieces = asStringArray(parsed.pieces, ['visible top or main layer', 'visible bottom or lower half', 'shoes not visible', 'accessories not visible', 'outerwear not visible'])
  const normalizedPieces = [...pieces, 'null', 'null', 'null', 'null', 'null'].slice(0, 5)

  return {
    outfit_name: asString(parsed.outfit_name, 'Attached Outfit'),
    style: asString(parsed.style, 'Personal Style'),
    vibe: asString(parsed.vibe, 'Considered look'),
    color_scheme: asString(parsed.color_scheme, 'Palette identified from the attached outfit photo.'),
    occasions: asStringArray(parsed.occasions, ['Everyday']),
    pieces: normalizedPieces,
    color_names: asStringArray(parsed.color_names),
    key_colors: asStringArray(parsed.key_colors).filter((hex) => /^#[0-9a-f]{6}$/i.test(hex)).slice(0, 6),
    why_it_works: asString(parsed.why_it_works, overallFallback),
    styling_tip: asString(parsed.styling_tip, 'If something feels off, repeat one key color in the shoes, bag, or outerwear to make the outfit feel intentional.'),
    match_score: mode === 'rating' ? clampScore(parsed.match_score) : null,
    skin_tone_feedback: asString(parsed.skin_tone_feedback, limitedSkinTone),
    overall_verdict: asString(parsed.overall_verdict, overallFallback),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const imageUrls = getImageUrls(body)
    const outfitDetails = asString(body.outfit_details)
    const skinTone = asString(body.skin_tone)
    const imageLabels = asStringArray(body.image_labels)
    const language = asString(body.language, 'en')
    const mode: AnalysisMode = asString(body.mode) === 'inventory' ? 'inventory' : 'rating'

    if (imageUrls.length === 0) return NextResponse.json({ error: 'At least one outfit image is required.' }, { status: 400 })

    let prompt = mode === 'inventory' ? INVENTORY_PROMPT : VISION_PROMPT
    if (skinTone) {
      prompt += `\n\nThe user's skin tone is: ${skinTone.replace(/_/g, ' ')}. Specifically analyze how the outfit colors interact with this skin tone.`
    } else {
      prompt += '\n\nThe user did not provide a skin tone. Do not invent one; explain skin-tone fit in conditional terms.'
    }
    if (language === 'ar') {
      prompt += '\n\nWrite every user-facing JSON string value in Arabic.'
    }
    if (outfitDetails) {
      prompt += `\n\nKnown outfit details from the user interface:\n${outfitDetails}`
    }
    if (imageUrls.length > 1) {
      const labels = imageUrls.map((_, index) => imageLabels[index] || `image ${index + 1}`).join(', ')
      prompt += `\n\nMultiple outfit images are provided in this order: ${labels}. Consider them together as one outfit.`
    }

    const { content } = await analyzeImageWithFallback(imageUrls, prompt)
    const parsed = extractJSON(content) as Record<string, unknown>
    const analysis = normalizeAnalysis(parsed, content, skinTone, mode)

    return NextResponse.json({ analysis, mode })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[analyze-outfit-image]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
