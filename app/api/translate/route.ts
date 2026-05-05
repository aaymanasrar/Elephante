import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback } from '@/services/aiProviders'
import { rateLimit } from '@/lib/rateLimit'

function parseTranslationMap(raw: string): Record<string, string> {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```\s*$/im, '')
      .trim()
    const json = cleaned.startsWith('{')
      ? cleaned
      : (cleaned.match(/\{[\s\S]*\}/) ?? ['{}'])[0]
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const translations: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') continue
      const trimmed = value.trim()
      if (trimmed) translations[key] = trimmed
    }
    return translations
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 30, window: 60 })
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } }
    )
  }

  try {
    const { texts, target = 'ar' } = await req.json()
    if (target !== 'ar') return NextResponse.json({ translations: {} })
    if (!Array.isArray(texts)) return NextResponse.json({ translations: {} })

    const uniqueTexts = Array.from(new Set(
      texts
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )).slice(0, 80)

    if (uniqueTexts.length === 0) return NextResponse.json({ translations: {} })

    const stringList = uniqueTexts
      .map((text, index) => String(index + 1) + '. ' + JSON.stringify(text))
      .join('\n')

    const prompt = `Translate these fashion UI strings into natural Arabic for a Saudi/Gulf fashion app.

Return ONLY a raw JSON object. Keys must be the exact original English strings. Values must be Arabic translations.

Rules:
- Preserve brand names exactly, e.g. Zara, COS, Nike.
- Preserve outfit codes exactly, e.g. MBC01, TH011.
- Translate fashion terms naturally, not word-for-word.
- Keep translations concise for chips and labels.
- Do not add explanations.

Strings:
${stringList}

JSON object only:`

    const response = await chatWithFallback(
      [
        { role: 'system', content: 'You are a precise Arabic fashion localization engine.' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.1, maxTokens: 1800 }
    )

    const translations = parseTranslationMap(response.content)
    return NextResponse.json({ translations })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[translate]', message)
    return NextResponse.json({ translations: {} })
  }
}
