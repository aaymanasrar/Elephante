import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { rateLimit } from '@/lib/rateLimit'

type ClosetItem = {
  id: number | string
  category?: string | null
  item_name?: string | null
  brand?: string | null
  color?: string | null
  occasion?: string | null
  image_url?: string | null
  [key: string]: unknown
}

type WeatherInput = {
  city?: string
  temperature_c?: number | string
  condition?: string
  wind_kph?: number | string
}

type UserProfileInput = {
  gender?: string | null
  skin_tone?: string | null
  body_shape?: string | null
  style_preference?: string | null
}

type ParsedSelectedItem = {
  id?: number | string
  reason?: string | null
}

type ParsedSuggestion = {
  outfit_name?: string
  selected_items?: ParsedSelectedItem[]
  ai_verdict?: string
}

type EnrichedClosetItem = ClosetItem & {
  reason?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 15, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  try {
    const body = await req.json() as Record<string, unknown>
    const weather = isRecord(body.weather) ? body.weather as WeatherInput : null
    const occasion = typeof body.occasion === 'string' ? body.occasion : ''
    const closetItems = Array.isArray(body.closet_items) ? body.closet_items as ClosetItem[] : []
    const selectedItemIds = Array.isArray(body.selected_item_ids) ? body.selected_item_ids : []
    const userProfile = isRecord(body.user_profile) ? body.user_profile as UserProfileInput : null
    const language = body.language === 'ar' ? 'ar' : 'en'

    if (closetItems.length === 0) {
      return NextResponse.json({ error: 'No closet items found. Add clothes to your wardrobe first.' }, { status: 400 })
    }

    const selectedIds = selectedItemIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
    const selectedIdSet = new Set(selectedIds)
    const selectedItems = selectedIds.length
      ? closetItems.filter((item) => selectedIdSet.has(Number(item.id)))
      : []

    if (selectedIds.length && selectedItems.length === 0) {
      return NextResponse.json({ error: 'Selected closet items were not found.' }, { status: 400 })
    }

    const weatherContext = weather
      ? `Current weather in ${weather.city}: ${weather.temperature_c}°C, ${weather.condition}, wind ${weather.wind_kph} km/h.`
      : 'No specific weather data (assume comfortable indoor/outdoor conditions).'

    const closetList = closetItems
      .map((item) => {
        const selectedMarker = selectedIdSet.has(Number(item.id)) ? ' | USER SELECTED BASE ITEM' : ''
        return `ID:${item.id} | ${item.category} | ${item.item_name || 'Unnamed'} | Color: ${item.color || 'unknown'} | Tags: ${item.occasion || 'general'}${selectedMarker}`
      })
      .join('\n')

    const selectedList = selectedItems
      .map((item) => `ID:${item.id} | ${item.category} | ${item.item_name || 'Unnamed'} | Color: ${item.color || 'unknown'} | Tags: ${item.occasion || 'general'}`)
      .join('\n')

    const isAr = language === 'ar'

    const prompt = `You are Elephante's AI Stylist. Pick the best complete outfit from this user's personal wardrobe.

CONTEXT:
${weatherContext}
Occasion: ${occasion || 'Casual'}
Gender: ${userProfile?.gender || 'unspecified'}
Skin Tone: ${userProfile?.skin_tone || 'unspecified'}
Body Shape: ${userProfile?.body_shape || 'unspecified'}
Style Preference: ${userProfile?.style_preference || 'unspecified'}

AVAILABLE WARDROBE ITEMS:
${closetList}

${selectedList ? `USER SELECTED BASE ITEMS:
${selectedList}` : ''}

INSTRUCTIONS:
- If USER SELECTED BASE ITEMS are provided, treat them as locked base pieces and include them in the final outfit whenever possible.
- Complete the look using only compatible items from AVAILABLE WARDROBE ITEMS.
- Select at most 1 item per category (tops and bottoms usually required; shoes if available; outerwear only if weather is cold <18°C; accessories optional).
- Only use item IDs from the list above — never invent items.
- Consider weather: cold (<15°C) → must include outerwear. Hot (>25°C) → skip outerwear, pick light fabrics.
- Match the occasion: office needs polished pieces, gym needs activewear, casual can be relaxed, etc.
- Ensure color harmony. Consider skin tone compatibility.
- If a required category has no suitable item, skip it (don't force a bad match).
- If selected base pieces conflict with each other, keep the strongest combination and explain the choice in ai_verdict.

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
    const parsed = extractJSON(textContent) as ParsedSuggestion

    if (!parsed || !Array.isArray(parsed.selected_items)) {
      return NextResponse.json({ error: 'AI could not suggest an outfit. Try again.' }, { status: 500 })
    }

    const itemMap = new Map(closetItems.map((item) => [Number(item.id), item]))
    const enrichedItems = parsed.selected_items
      .reduce<EnrichedClosetItem[]>((items, sel) => {
        const full = itemMap.get(Number(sel.id))
        if (full) items.push({ ...full, reason: sel.reason || null })
        return items
      }, [])

    const enrichedIds = new Set(enrichedItems.map((item) => Number(item.id)))
    for (const selected of selectedItems) {
      const selectedId = Number(selected.id)
      if (enrichedIds.has(selectedId)) continue
      enrichedItems.push({
        ...selected,
        reason: isAr ? 'اخترتها أنت كقطعة أساسية في الإطلالة.' : 'Selected by you as a base piece for the outfit.',
      })
      enrichedIds.add(selectedId)
    }

    const selectedOrder = new Map(selectedIds.map((id: number, index: number) => [id, index]))
    const categoryOrder: Record<string, number> = { tops: 0, outerwear: 1, bottoms: 2, shoes: 3, accessories: 4 }
    enrichedItems.sort((a, b) => {
      const aSelected = selectedOrder.has(Number(a.id))
      const bSelected = selectedOrder.has(Number(b.id))
      if (aSelected !== bSelected) return aSelected ? -1 : 1
      if (aSelected && bSelected) return (selectedOrder.get(Number(a.id)) || 0) - (selectedOrder.get(Number(b.id)) || 0)
      return (categoryOrder[a.category || ''] ?? 99) - (categoryOrder[b.category || ''] ?? 99)
    })

    return NextResponse.json({
      outfit_name: parsed.outfit_name || "Today's Look",
      selected_items: enrichedItems,
      ai_verdict: parsed.ai_verdict || '',
      locked_item_ids: selectedIds,
    })
  } catch (error) {
    console.error('outfit-suggest-from-closet error:', error)
    return NextResponse.json({ error: 'Failed to generate outfit suggestion.' }, { status: 500 })
  }
}
