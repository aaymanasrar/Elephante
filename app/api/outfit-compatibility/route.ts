import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { scoreOutfitCompatibility, hasRenderOnnxConfig } from '@/lib/renderOnnxServer'

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  try {
    const body = await req.json()
    const { image_urls, item_names, occasion = 'casual', language = 'en' } = body

    if (!Array.isArray(image_urls) || image_urls.length < 2) {
      return NextResponse.json({ error: 'Provide at least 2 image_urls.' }, { status: 400 })
    }

    // Run CLIP scoring and AI text analysis in parallel
    const [clipResult, aiResult] = await Promise.allSettled([
      hasRenderOnnxConfig()
        ? scoreOutfitCompatibility(image_urls.slice(0, 5), occasion)
        : Promise.reject(new Error('Render server not configured')),
      (async () => {
        const itemList = Array.isArray(item_names) && item_names.length
          ? item_names.map((n: string, i: number) => `${i + 1}. ${n}`).join('\n')
          : image_urls.map((_: string, i: number) => `Item ${i + 1}`).join('\n')

        const prompt = `You are a fashion stylist. Rate the compatibility of this outfit combination.

Occasion: ${occasion}
Items:
${itemList}

Return ONLY this JSON (no markdown), with text in ${language === 'ar' ? 'Arabic' : 'English'}:
{
  "score": <0-100 integer>,
  "verdict": "<one short phrase>",
  "color_harmony": "<one sentence>",
  "style_notes": "<one sentence>",
  "suggestion": "<one actionable improvement tip>"
}`

        const response = await chatWithFallback([{ role: 'user', content: prompt }], { maxTokens: 400 })
        return extractJSON(response.content || '') as Record<string, unknown>
      })(),
    ])

    const clip = clipResult.status === 'fulfilled' ? clipResult.value : null
    const ai = aiResult.status === 'fulfilled' ? aiResult.value : null

    // Blend scores: CLIP 40% + AI 60% if both available, else use whichever succeeded
    let finalScore: number
    if (clip && ai && typeof ai.score === 'number') {
      finalScore = Math.round(clip.score * 0.4 + Number(ai.score) * 0.6)
    } else if (ai && typeof ai.score === 'number') {
      finalScore = Number(ai.score)
    } else if (clip) {
      finalScore = clip.score
    } else {
      finalScore = 50
    }

    return NextResponse.json({
      score: finalScore,
      verdict: ai?.verdict ?? clip?.verdict ?? 'Scored',
      color_harmony: ai?.color_harmony ?? null,
      style_notes: ai?.style_notes ?? null,
      suggestion: ai?.suggestion ?? null,
      clip_score: clip?.score ?? null,
      clip_breakdown: clip?.breakdown ?? null,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to score outfit'
    console.error('outfit-compatibility error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
