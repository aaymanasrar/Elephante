import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 15, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  try {
    const body = await req.json()
    const { weather, occasion, closet_items, user_profile, language = 'en' } = body

    if (!closet_items || closet_items.length === 0) {
      return NextResponse.json({ error: 'No closet items found. Add clothes to your wardrobe first.' }, { status: 400 })
    }

    const weatherContext = weather
      ? `Current weather in ${weather.city}: ${weather.temperature_c}°C, ${weather.condition}, wind ${weather.wind_kph} km/h.`
      : 'No specific weather data (assume comfortable indoor/outdoor conditions).'

    const closetList = closet_items
      .map((item: any) => `ID:${item.id} | ${item.category} | ${item.item_name || 'Unnamed'} | Color: ${item.color || 'unknown'} | Tags: ${item.occasion || 'general'}`)
      .join('\n')

    const isAr = language === 'ar'

    const prompt = `You are Elephante's AI Stylist. Pick the best complete outfit from this user's personal wardrobe.

CONTEXT:
${weatherContext}
Occasion: ${occasion || 'Casual'}
Gender: ${user_profile?.gender || 'unspecified'}
Skin Tone: ${user_profile?.skin_tone || 'unspecified'}
Body Shape: ${user_profile?.body_shape || 'unspecified'}
Style Preference: ${user_profile?.style_preference || 'unspecified'}

AVAILABLE WARDROBE ITEMS:
${closetList}

INSTRUCTIONS:
- Select at most 1 item per category (tops and bottoms usually required; shoes if available; outerwear only if weather is cold <18°C; accessories optional).
- Only use item IDs from the list above — never invent items.
- Consider weather: cold (<15°C) → must include outerwear. Hot (>25°C) → skip outerwear, pick light fabrics.
- Match the occasion: office needs polished pieces, gym needs activewear, casual can be relaxed, etc.
- Ensure color harmony. Consider skin tone compatibility.
- If a required category has no suitable item, skip it (don't force a bad match).

Return ONLY this JSON (no markdown, no explanation), with ai_verdict in ${isAr ? 'Arabic' : 'English'}:
{
  "outfit_name": "Short evocative name for this look",
  "selected_items": [
    { "id": 123, "category": "tops", "item_name": "...", "reason": "why this piece works for the occasion/weather" },
    { "id": 456, "category": "bottoms", "item_name": "...", "reason": "..." },
    { "id": 789, "category": "shoes", "item_name": "...", "reason": "..." }
  ],
  "ai_verdict": "2-3 sentence verdict about this complete look and why it suits today"
}`

    const turns: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'user', content: prompt },
    ]

    const responseContent = await chatWithFallback(turns, { maxTokens: 1000 })
    const textContent = responseContent.content || ''
    const parsed = extractJSON(textContent) as Record<string, any>

    if (!parsed || !Array.isArray(parsed.selected_items)) {
      return NextResponse.json({ error: 'AI could not suggest an outfit. Try again.' }, { status: 500 })
    }

    const itemMap = new Map(closet_items.map((item: any) => [Number(item.id), item]))
    const enrichedItems = parsed.selected_items
      .map((sel: any) => {
        const full = itemMap.get(Number(sel.id))
        if (!full) return null
        return { ...full, reason: sel.reason }
      })
      .filter(Boolean)

    return NextResponse.json({
      outfit_name: parsed.outfit_name || "Today's Look",
      selected_items: enrichedItems,
      ai_verdict: parsed.ai_verdict || '',
    })
  } catch (error: any) {
    console.error('outfit-suggest-from-closet error:', error)
    return NextResponse.json({ error: 'Failed to generate outfit suggestion.' }, { status: 500 })
  }
}
