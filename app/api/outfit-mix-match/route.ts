import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { selected_pieces, closet_items, user_profile, language = 'en' } = body

    if (!closet_items || !Array.isArray(closet_items)) {
      return NextResponse.json({ error: 'Closet items are required.' }, { status: 400 })
    }

    const activeSelectedStr = Object.entries(selected_pieces || {})
      .map(([zone, item]: [string, any]) => {
        if (!item.preview && !item.prompt) return null
        return `${zone.toUpperCase()}: ${item.prompt || item.label || 'Attached Image'}`
      })
      .filter(Boolean)
      .join('\n')

    const closetOptionsStr = closet_items
      .map((item: any) => {
        return `ID: ${item.id} | Category: ${item.category} | Name: ${item.item_name} | Color: ${item.color || 'Unknown'} | Brand: ${item.brand || 'Unknown'}`
      })
      .join('\n')

    const prompt = `You are Elephante's expert high-fashion styling director. The user has placed some items on their Outfit Flat-Lay canvas and wants you to intelligently select matching garments from their personal Closet to fill in the empty zones!

The current selected canvas is:
${activeSelectedStr || 'No items selected yet. Select a matching outfit from scratch!'}

The available wardrobe options inside their personal Closet are:
${closetOptionsStr || 'No closet items found.'}

User Profile:
- Gender: ${user_profile?.gender || 'Unspecified'}
- Skin Tone: ${user_profile?.skin_tone || 'Unspecified'}
- Body Shape: ${user_profile?.body_shape || 'Unspecified'}
- Style Preference: ${user_profile?.style_preference || 'Unspecified'}

Intelligent matchmaking rules:
1. Identify which zones are empty in the selected canvas (top, outerwear, bottom, shoes, accessories).
2. Look through the user's available Closet items. Match item categories in this way:
   - 'tops' closet items correspond to the 'top' canvas zone.
   - 'bottoms' closet items correspond to the 'bottom' canvas zone.
   - 'shoes' closet items correspond to the 'shoes' canvas zone.
   - 'outerwear' closet items correspond to the 'outerwear' canvas zone.
   - 'accessories' closet items correspond to the 'accessories' canvas zone.
3. Find items of the correct category that stylistically, contextually, and aesthetically pair perfectly with the already selected pieces. Keep in mind color harmony, silhouettes, seasonal suitability, and the user's personal profile (skin tone and body shape).
4. If no matching item is found in their closet for a specific empty category, do not suggest anything for that zone; keep it empty. Do not invent non-existent items.
5. If there are no empty zones, analyze their current selection and offer a compliment or refinement suggestion.
6. Output a raw JSON object with the exact format (and translate all styling reasons and verdicts to Arabic if the language is 'ar'):
{
  "matches": [
    {
      "zone": "top | outerwear | bottom | shoes | accessories",
      "closet_item_id": 123,
      "item_name": "...",
      "image_url": "...",
      "color": "...",
      "reason": "Styling justification explaining why this item completes the look."
    }
  ],
  "ai_verdict": "Short conversational justification about how these selections complete the look."
}

Do not write any other explanation or markdown. Return ONLY the raw JSON.`

    const turns: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'user', content: prompt }
    ]

    const responseContent = await chatWithFallback(turns, { maxTokens: 1600, json: true })
    const textContent = responseContent.content || ''
    const parsed = extractJSON(textContent) as Record<string, any>

    return NextResponse.json(parsed || { matches: [], ai_verdict: 'AI Stylist checked your closet but couldn\'t find suitable items. Try adding more items to your closet!' })
  } catch (error: any) {
    console.error('Mix and Match Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to mix and match' }, { status: 500 })
  }
}
