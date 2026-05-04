import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getOpenAIKeys, isOpenAIQuotaError } from '@/lib/openaiKeys'
import { buildCatalogMannequinImagePrompt } from '@/lib/outfitImagePrompt'
import type { Outfit } from '@/types/outfit'

interface Profile {
  gender?: string | null
  [key: string]: unknown
}

interface OutfitPiece {
  item?: string | null
}

interface OutfitPieces {
  top?: OutfitPiece
  bottom?: OutfitPiece
  shoes?: OutfitPiece
  accessories?: OutfitPiece
  outerwear?: OutfitPiece | null
}

interface OutfitWithPieces extends Omit<Outfit, 'pieces'> {
  pieces?: OutfitPieces
  outfit_name?: string
  color_scheme?: string
  key_colors?: string[]
  occasion?: string
  vibe?: string
  style?: string
}

function buildPrompt(outfit: OutfitWithPieces, profile: Profile): string {
  const gender    = profile?.gender           || 'male'

  const p = outfit?.pieces || {}
  const pieces: string[] = [
    p.top?.item, p.bottom?.item, p.shoes?.item,
    p.accessories?.item, p.outerwear?.item,
  ].filter((x): x is string => Boolean(x))

  return buildCatalogMannequinImagePrompt({
    gender,
    pieces,
    style: outfit?.style || outfit?.outfit_name,
    colorScheme: outfit?.color_scheme,
    colors: outfit?.key_colors,
    extraDetails: [outfit?.occasion, outfit?.vibe],
  })
}

// ── Higgsfield (platform.higgsfield.ai — FLUX Pro, portrait 9:16) ─────────────
async function generateWithHiggsfield(prompt: string): Promise<string> {
  const keyId     = process.env.HIGGSFIELD_API_KEY_ID
  const keySecret = process.env.HIGGSFIELD_API_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('Higgsfield keys not configured')

  const authHeader = `Key ${keyId}:${keySecret}`
  const BASE       = 'https://platform.higgsfield.ai'
  const ENDPOINT   = `${BASE}/flux-pro/kontext/max/text-to-image`

  // 1 — Start generation
  const genRes = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ input: { prompt, aspect_ratio: '9:16', safety_tolerance: 2 } }),
    signal:  AbortSignal.timeout(15_000),
  })
  if (!genRes.ok) throw new Error(`Higgsfield start failed (${genRes.status})`)

  const genData   = await genRes.json()
  const requestId = genData.request_id || genData.id
  if (!requestId) throw new Error('Higgsfield: no request_id in response')

  // 2 — Poll until completed (max 90 s)
  const pollUrl = `${ENDPOINT}/${requestId}`
  const deadline = Date.now() + 90_000

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000))

    const pollRes = await fetch(pollUrl, {
      headers: { 'Authorization': authHeader },
      signal:  AbortSignal.timeout(10_000),
    })
    if (!pollRes.ok) continue

    const data = await pollRes.json()

    if (data.status === 'completed') {
      const imageUrl = data.images?.[0]?.url
      if (!imageUrl) throw new Error('Higgsfield: no image URL in completed response')
      // Fetch image and return as base64 data URL (consistent with Pollinations)
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) })
      if (!imgRes.ok) throw new Error('Higgsfield: failed to download generated image')
      const buf    = await imgRes.arrayBuffer()
      const base64 = Buffer.from(buf).toString('base64')
      const mime   = imgRes.headers.get('content-type') || 'image/jpeg'
      return `data:${mime};base64,${base64}`
    }

    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(`Higgsfield generation failed: ${data.error || data.message || 'unknown'}`)
    }
    // 'queued' | 'in_progress' → keep polling
  }

  throw new Error('Higgsfield generation timed out after 90 s')
}

// ── DALL-E 3 (OpenAI — best at following detailed garment descriptions) ───────
async function generateWithDallE3(prompt: string, apiKey: string): Promise<string> {
  const client = new OpenAI({ apiKey, timeout: 60_000 })

  // DALL-E 3 needs a clear, structured description — prepend a fashion photo context
  const dallePrompt = `${prompt}. Maintain the exact archive style: a smooth white faceless mannequin on a pure white background, full-body centered product photo.`

  const response = await client.images.generate({
    model:   'dall-e-3',
    prompt:  dallePrompt,
    size:    '1024x1792',   // portrait 9:16
    quality: 'standard',
    n:       1,
  })

  const imageUrl = response.data?.[0]?.url
  if (!imageUrl) throw new Error('DALL-E 3: no URL in response')

  // Download and convert to base64 (consistent with other providers)
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) })
  if (!imgRes.ok) throw new Error('DALL-E 3: failed to download image')
  const buf    = await imgRes.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')
  const mime   = imgRes.headers.get('content-type') || 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

// ── Pollinations (free, no key needed — token unlocks higher limits) ─────────
async function generateWithPollinations(prompt: string): Promise<string> {
  const token = process.env.POLLINATIONS_TOKEN
  const params = new URLSearchParams({
    width: '512', height: '768', nologo: 'true', model: 'flux',
    ...(token ? { token } : {}),
  })
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`
  const imgRes = await fetch(url, { signal: AbortSignal.timeout(35000) })
  if (!imgRes.ok) throw new Error(`Image generation is busy right now — try again in a moment (${imgRes.status})`)
  const buf    = await imgRes.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')
  const mime   = imgRes.headers.get('content-type') || 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

function friendlyError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message
    if (err.name === 'TimeoutError' || msg.toLowerCase().includes('aborted') || msg.toLowerCase().includes('timeout'))
      return 'Styling is taking longer than usual — try again in a moment'
    return msg
  }
  return 'An unexpected error occurred'
}

// ── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { outfit, profile } = await req.json()
    const prompt = buildPrompt(outfit, profile)

    // 1. Higgsfield — FLUX Pro, highest quality cinematic fashion
    if (process.env.HIGGSFIELD_API_KEY_ID && process.env.HIGGSFIELD_API_KEY_SECRET) {
      try {
        const image = await generateWithHiggsfield(prompt)
        return NextResponse.json({ image, provider: 'higgsfield' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[generate-outfit-image] Higgsfield failed:', message)
      }
    }

    // 2. DALL-E 3 — best at following detailed garment/styling descriptions
    const openAIKeys = getOpenAIKeys()
    if (openAIKeys.length > 0) {
      try {
        let lastDallEError: unknown = null
        for (const [index, apiKey] of openAIKeys.entries()) {
          try {
            const image = await generateWithDallE3(prompt, apiKey)
            return NextResponse.json({ image, provider: index === 0 ? 'dalle3' : `dalle3-backup-${index + 1}` })
          } catch (err) {
            lastDallEError = err
            const message = err instanceof Error ? err.message : 'Unknown error'
            const keyLabel = index === 0 ? 'primary key' : `backup key ${index + 1}`
            const reason = isOpenAIQuotaError(err) ? 'quota/rate limit' : message
            console.warn(`[generate-outfit-image] DALL-E 3 failed with ${keyLabel}:`, reason)
          }
        }

        if (lastDallEError) throw lastDallEError
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[generate-outfit-image] All DALL-E 3 keys failed:', message)
      }
    }

    // 3. Pollinations — free fallback (FLUX)
    const image = await generateWithPollinations(prompt)
    return NextResponse.json({ image, provider: 'pollinations' })
  } catch (err: any) {
    console.error('[generate-outfit-image]', err.message)
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 })
  }
}
