import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getOpenAIKeys, isOpenAIQuotaError } from '@/lib/openaiKeys'
import { downloadImageAsDataUrl, generateEdenAIImage, hasEdenAIImageConfig } from '@/lib/edenaiImage'
import { generateMagnificMysticImage, hasMagnificImageConfig } from '@/lib/magnificImage'
import { buildCatalogMannequinImagePrompt } from '@/lib/outfitImagePrompt'
import { generateSkyworkImage, hasSkyworkImageConfig } from '@/lib/skyworkImage'
import { generateFalImage, hasFalImageConfig } from '@/lib/falImage'
import type { Outfit } from '@/types/outfit'

export const maxDuration = 300

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
      return downloadImageAsDataUrl(imageUrl, 'Higgsfield', 15_000)
    }

    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(`Higgsfield generation failed: ${data.error || data.message || 'unknown'}`)
    }
    // 'queued' | 'in_progress' → keep polling
  }

  throw new Error('Higgsfield generation timed out after 90 s')
}

// ── GPT Image 2 (gpt-image-1 — best prompt adherence, photorealistic) ────────
async function generateWithGptImage2(prompt: string, apiKey: string): Promise<string> {
  const client = new OpenAI({ apiKey, timeout: 90_000 })

  const enhancedPrompt = `Fashion product catalog photograph. ${prompt}. Pure white seamless studio background, full-body centered composition showing the complete outfit from head to shoes. Soft even studio lighting, crisp realistic garment texture, professional product photography. Smooth white faceless mannequin, no facial features, no skin, no hair. No text, no watermarks, no props.`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.images.generate as any)({
    model:   'gpt-image-1',
    prompt:  enhancedPrompt,
    size:    '1024x1536',
    quality: 'high',
    n:       1,
  }) as { data?: Array<{ b64_json?: string; url?: string }> }

  const b64 = response.data?.[0]?.b64_json
  if (b64) return `data:image/png;base64,${b64}`

  const imageUrl = response.data?.[0]?.url
  if (imageUrl) return downloadImageAsDataUrl(imageUrl, 'GPT Image 2')

  throw new Error('GPT Image 2: no image data in response')
}

// ── DALL-E 3 (OpenAI — fallback, good at detailed garment descriptions) ───────
async function generateWithDallE3(prompt: string, apiKey: string): Promise<string> {
  const client = new OpenAI({ apiKey, timeout: 60_000 })

  const dallePrompt = `${prompt}. Maintain the exact archive style: a smooth white faceless mannequin on a pure white background, full-body centered product photo.`

  const response = await client.images.generate({
    model:   'dall-e-3',
    prompt:  dallePrompt,
    size:    '1024x1792',
    quality: 'standard',
    n:       1,
  })

  const imageUrl = response.data?.[0]?.url
  if (!imageUrl) throw new Error('DALL-E 3: no URL in response')

  return downloadImageAsDataUrl(imageUrl, 'DALL-E 3')
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
    const avatarUrl = profile?.avatar_url

    const respond = async (imageSrc: string, provider: string, extra = {}) => {
      let finalImg = imageSrc
      if (avatarUrl) {
        const { compositeAvatar } = await import('@/lib/avatarComposition')
        finalImg = await compositeAvatar(finalImg, avatarUrl)
      }
      return NextResponse.json({ image: finalImg, provider, ...extra })
    }

    // 1. FAL.ai — FLUX Pro v1.1, photorealistic fashion quality
    if (hasFalImageConfig()) {
      try {
        const { dataUrl, model } = await generateFalImage(prompt)
        return await respond(dataUrl, 'fal-flux-pro', { model })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[generate-outfit-image] FAL.ai failed:', message)
      }
    }

    // 3. Skywork Image API — configured through SKYWORK_API_KEY
    if (hasSkyworkImageConfig()) {
      try {
        const { dataUrl, model, resourceUrl } = await generateSkyworkImage(prompt)
        return await respond(dataUrl, 'skywork', { model, resourceUrl })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[generate-outfit-image] Skywork failed:', message)
      }
    }

    // 4. Magnific Mystic — premium high-resolution realism
    if (hasMagnificImageConfig()) {
      try {
        const { dataUrl, model, taskId } = await generateMagnificMysticImage(prompt)
        return await respond(dataUrl, 'magnific-mystic', { model, taskId })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[generate-outfit-image] Magnific failed:', message)
      }
    }

    // 5. EdenAI — ByteDance Seedream through the Universal AI endpoint
    if (hasEdenAIImageConfig()) {
      try {
        const { dataUrl, cost, model } = await generateEdenAIImage(prompt)
        return await respond(dataUrl, 'edenai-seedream', { model, cost })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[generate-outfit-image] EdenAI failed:', message)
      }
    }

    // 6. Higgsfield — FLUX Pro, highest quality cinematic fashion
    if (process.env.HIGGSFIELD_API_KEY_ID && process.env.HIGGSFIELD_API_KEY_SECRET) {
      try {
        const image = await generateWithHiggsfield(prompt)
        return await respond(image, 'higgsfield')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[generate-outfit-image] Higgsfield failed:', message)
      }
    }

    // 7. GPT Image 2 (gpt-image-1) — highest prompt adherence, photorealistic
    const openAIKeys = getOpenAIKeys()
    if (openAIKeys.length > 0) {
      try {
        let lastGptImg2Error: unknown = null
        for (const [index, apiKey] of openAIKeys.entries()) {
          try {
            const image = await generateWithGptImage2(prompt, apiKey)
            return await respond(image, index === 0 ? 'gpt-image-2' : `gpt-image-2-backup-${index + 1}`)
          } catch (err) {
            lastGptImg2Error = err
            const message = err instanceof Error ? err.message : 'Unknown error'
            const keyLabel = index === 0 ? 'primary key' : `backup key ${index + 1}`
            const reason = isOpenAIQuotaError(err) ? 'quota/rate limit' : message
            console.warn(`[generate-outfit-image] GPT Image 2 failed with ${keyLabel}:`, reason)
          }
        }
        if (lastGptImg2Error) throw lastGptImg2Error
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[generate-outfit-image] All GPT Image 2 keys failed, trying DALL-E 3:', message)
      }

      // 8. DALL-E 3 — fallback if gpt-image-1 unavailable
      try {
        let lastDallEError: unknown = null
        for (const [index, apiKey] of openAIKeys.entries()) {
          try {
            const image = await generateWithDallE3(prompt, apiKey)
            return await respond(image, index === 0 ? 'dalle3' : `dalle3-backup-${index + 1}`)
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

    // 8. Pollinations — free fallback (FLUX)
    const image = await generateWithPollinations(prompt)
    return await respond(image, 'pollinations')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-outfit-image]', message)
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 })
  }
}

