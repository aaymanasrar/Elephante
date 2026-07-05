import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { rateLimit } from '@/lib/rateLimit'

const SYSTEM_PROMPT = `You are a fashion duplicate detector. Given a new item description and a list of items the user owns, determine if they already own something similar enough that buying the new item would be redundant.

Return ONLY raw JSON (no markdown, no code blocks):
{
  "has_duplicate": true,
  "similar_item": "the item they own that's similar, or null",
  "similarity_reason": "one sentence explaining why it's similar, or null"
}

Consider similar: same garment type + similar color + similar formality level.
Not similar: different garment type, very different color, or different formality.`

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 15, window: 60 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  try {
    const { item_description, user_id } = await req.json()

    if (!item_description || typeof item_description !== 'string') {
      return NextResponse.json({ error: 'item_description is required' }, { status: 400 })
    }
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch the user's wardrobe items
    const { data: closetItems, error: dbError } = await supabase
      .from('closet_items')
      .select('item_name, item_type, color, occasion, pieces')
      .eq('user_id', user_id)
      .limit(100)

    if (dbError) {
      console.error('[check-duplicate] DB error:', dbError.message)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    if (!closetItems || closetItems.length === 0) {
      return NextResponse.json({
        has_duplicate: false,
        similar_item: null,
        similarity_reason: null,
      })
    }

    // Build a compact wardrobe list for the AI
    const wardrobeList = closetItems
      .map((item) => {
        const parts = [item.item_name]
        if (item.color) parts.push(`(${item.color})`)
        if (item.item_type && item.item_type !== item.item_name) parts.push(`[${item.item_type}]`)
        if (item.occasion) parts.push(`— ${item.occasion}`)
        return parts.join(' ')
      })
      .join('\n')

    const userMessage = `New item to consider buying:\n"${item_description.trim().slice(0, 200)}"\n\nItems the user already owns:\n${wardrobeList}`

    const result = await chatWithFallback(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      { maxTokens: 200, temperature: 0.3, json: true }
    )

    const parsed = extractJSON(result.content) as {
      has_duplicate?: boolean
      similar_item?: string | null
      similarity_reason?: string | null
    }

    return NextResponse.json({
      has_duplicate: parsed?.has_duplicate === true,
      similar_item: typeof parsed?.similar_item === 'string' ? parsed.similar_item : null,
      similarity_reason: typeof parsed?.similarity_reason === 'string' ? parsed.similarity_reason : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[check-duplicate]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
