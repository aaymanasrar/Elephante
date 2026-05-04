import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithFallback, extractJSON } from '@/services/aiProviders'

const VISION_PROMPT = `You are Elephante's AI Stylist. Analyse this outfit image and return ONLY a raw JSON object (no markdown, no code blocks) with this exact structure:
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
  "styling_tip": "one actionable tip to elevate the look"
}
For pieces: always 5 strings in order [top, bottom, shoes, accessories, outerwear]. Use null string if a piece is not visible.
For color_names: simple English color names like Navy, White, Tan, Charcoal etc.`

export async function POST(req: NextRequest) {
  try {
    const { image_url, outfit_details } = await req.json()
    if (!image_url) return NextResponse.json({ error: 'image_url required' }, { status: 400 })

    const prompt = outfit_details
      ? `${VISION_PROMPT}\n\nKnown stylist notes about this outfit: "${outfit_details}" — use this to inform and enrich why_it_works.`
      : VISION_PROMPT

    const { content } = await analyzeImageWithFallback(image_url, prompt)
    const analysis = extractJSON(content)

    return NextResponse.json({ analysis })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[analyze-outfit-image]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
