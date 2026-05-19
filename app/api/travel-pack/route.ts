import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { rateLimit } from '@/lib/rateLimit'

export const maxDuration = 120

const SYSTEM = `You are Elephante, a travel wardrobe expert. Create a smart, capsule packing list for a trip. Focus on versatile pieces that can be mixed and matched. Tailor to the user's gender, body shape, and style. Keep it practical — no overpacking.

Return ONLY raw JSON (no markdown, no code fences):
{
  "destination_summary": "one sentence about the fashion culture/dress code of this destination",
  "outfits": [
    { "day": "Day 1", "outfit": "full outfit description", "occasion": "occasion name" }
  ],
  "essentials": ["item1", "item2"],
  "shoes": ["shoe1", "shoe2"],
  "accessories": ["item1", "item2"],
  "pro_tip": "one travel styling tip"
}`

export async function POST(req: NextRequest) {
  const { ok, retryAfter } = rateLimit(req, { limit: 5, window: 60 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const { destination, duration, occasions, climate, profile } = await req.json()

    if (!destination?.trim()) {
      return NextResponse.json({ error: 'Destination is required.' }, { status: 400 })
    }

    const gender = profile?.gender || 'unspecified'
    const skin_tone = profile?.skin_tone || 'medium'
    const body_shape = profile?.body_shape || 'average'
    const style_pref = profile?.style_pref || profile?.style || 'versatile'

    const occasionList = Array.isArray(occasions) && occasions.length > 0
      ? occasions.join(', ')
      : 'General travel'

    const userMessage = `Trip to ${destination} for ${duration}. Occasions: ${occasionList}. Climate: ${climate}. User: ${gender}, ${skin_tone} skin, ${body_shape} build, ${style_pref} style.`

    const result = await chatWithFallback(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userMessage },
      ],
      { maxTokens: 1500, temperature: 0.7 }
    )

    const parsed = extractJSON(result.content)

    return NextResponse.json({ packingList: parsed, provider: result.provider })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[travel-pack]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
