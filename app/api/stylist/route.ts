import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { optionalEnv } from '@/lib/env'
import { downloadImageAsDataUrl, generateEdenAIImage, hasEdenAIImageConfig } from '@/lib/edenaiImage'
import { generateMagnificMysticImage, hasMagnificImageConfig } from '@/lib/magnificImage'
import { getOpenAIKeys, isOpenAIQuotaError } from '@/lib/openaiKeys'
import { rateLimit } from '@/lib/rateLimit'
import { buildCatalogMannequinImagePrompt } from '@/lib/outfitImagePrompt'
import { generateSkyworkImage, hasSkyworkImageConfig } from '@/lib/skyworkImage'
import { chatWithFallback } from '@/services/aiProviders'

export const maxDuration = 300

function sanitizeOccasion(value: string) {
  return value.replace(/[^\p{L}\p{N}\s,.'-]/gu, ' ').replace(/\s+/g, ' ').trim()
}

async function generateImage(description: string): Promise<string> {
  const fullPrompt = buildCatalogMannequinImagePrompt({
    pieces: [description],
    extraDetails: ['occasion-based AI stylist outfit visualization'],
  })

  if (hasSkyworkImageConfig()) {
    try {
      const { dataUrl } = await generateSkyworkImage(fullPrompt)
      return dataUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.warn('[stylist] Skywork failed:', message)
    }
  }

  if (hasMagnificImageConfig()) {
    try {
      const { dataUrl } = await generateMagnificMysticImage(fullPrompt)
      return dataUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.warn('[stylist] Magnific failed:', message)
    }
  }

  if (hasEdenAIImageConfig()) {
    try {
      const { dataUrl } = await generateEdenAIImage(fullPrompt)
      return dataUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.warn('[stylist] EdenAI failed:', message)
    }
  }

  for (const [index, openAiKey] of getOpenAIKeys().entries()) {
    try {
      const client = new OpenAI({ apiKey: openAiKey, timeout: 60_000 })
      const response = await client.images.generate({
        model: 'dall-e-3',
        prompt: fullPrompt,
        size: '1024x1792',
        quality: 'standard',
        n: 1,
      })

      const imageUrl = response.data?.[0]?.url
      if (imageUrl) {
        return downloadImageAsDataUrl(imageUrl, 'DALL-E 3')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const keyLabel = index === 0 ? 'primary key' : `backup key ${index + 1}`
      const reason = isOpenAIQuotaError(error) ? 'quota/rate limit' : message
      console.warn(`[stylist] DALL-E 3 failed with ${keyLabel}:`, reason)
    }
  }

  const token = optionalEnv('POLLINATIONS_TOKEN')
  const params = new URLSearchParams({
    width: '512',
    height: '768',
    nologo: 'true',
    model: 'flux',
    ...(token ? { token } : {}),
  })
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?${params}`
  const response = await fetch(url, { signal: AbortSignal.timeout(35_000) })
  if (!response.ok) throw new Error(`Pollinations failed (${response.status})`)

  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mime = response.headers.get('content-type') || 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

export async function POST(request: NextRequest) {
  const { ok, retryAfter } = rateLimit(request, { limit: 5, window: 60 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many styling requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const body = await request.json()
    const rawOccasion = typeof body?.occasion === 'string' ? body.occasion : ''
    const occasion = sanitizeOccasion(rawOccasion)

    if (occasion.length < 2 || occasion.length > 200) {
      return NextResponse.json(
        { error: 'Please enter an occasion between 2 and 200 characters.' },
        { status: 400 }
      )
    }

    const aiData = await chatWithFallback([
      {
        role: 'user',
        content: `You are a fashion stylist. Describe a detailed, beautiful outfit for this occasion: ${occasion}. Focus on colors and fabrics. Keep it under 3 sentences.`,
      },
    ], { temperature: 0.8, maxTokens: 220 })

    const description = aiData.content || 'A stylish outfit'
    const image = await generateImage(description)

    return NextResponse.json({ text: description, image })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong!'
    console.error('[stylist]', message)
    return NextResponse.json({ error: 'We could not style this occasion right now.' }, { status: 500 })
  }
}
