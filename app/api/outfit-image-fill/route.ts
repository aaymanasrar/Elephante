import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { optionalEnv, requireEnv } from '@/lib/env'
import { generateEdenAIImage, hasEdenAIImageConfig } from '@/lib/edenaiImage'
import { generateMagnificMysticImage, hasMagnificImageConfig } from '@/lib/magnificImage'
import { buildCatalogMannequinImagePrompt } from '@/lib/outfitImagePrompt'

const supabase = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'outfit image fill'),
  requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'outfit image fill'),
)

interface FillOutfit {
  id?: string | number | null
  source_id?: string | null
  outfit_code?: string | null
  gender?: string | null
  top_wear?: string | null
  bottom_wear?: string | null
  shoes?: string | null
  accessories?: string | null
  outerwear?: string | null
  style_category?: string | null
  color_scheme?: string | null
  hex_colors?: string[] | string | null
  when_to_wear?: string | null
}

// Build a prompt using excel_outfits field structure
function buildPrompt(outfit: FillOutfit): string {
  return buildCatalogMannequinImagePrompt({
    gender: outfit.gender,
    pieces: [
      outfit.top_wear,
      outfit.bottom_wear,
      outfit.shoes,
      outfit.accessories,
      outfit.outerwear,
    ],
    style: outfit.style_category,
    colorScheme: outfit.color_scheme,
    colors: outfit.hex_colors,
    extraDetails: [outfit.when_to_wear],
  })
}

// Deterministic seed from source_id so the same outfit always generates the same image
function seedFromId(id: string): number {
  return Math.abs([...id].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)) % 2147483647
}

function dataUrlToUpload(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/)
  const contentType = match?.[1] || 'image/png'
  const base64 = match?.[2] || dataUrl

  return {
    buffer: Buffer.from(base64.replace(/\s/g, ''), 'base64'),
    contentType,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { outfit, outfitId, source } = await req.json() as {
      outfit?: FillOutfit
      outfitId?: string | number | null
      source?: string
    }
    if (!outfit) return NextResponse.json({ error: 'outfit data required' }, { status: 400 })

    const prompt = buildPrompt(outfit)
    const seed   = seedFromId(outfit.source_id || outfit.outfit_code || String(outfitId))
    let generatedBuffer: Buffer | null = null
    let generatedContentType = 'image/png'
    let fallbackImageUrl: string | null = null

    if (hasMagnificImageConfig()) {
      try {
        const { dataUrl, resourceUrl } = await generateMagnificMysticImage(prompt)
        const upload = dataUrlToUpload(dataUrl)
        generatedBuffer = upload.buffer
        generatedContentType = upload.contentType
        fallbackImageUrl = resourceUrl || dataUrl
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[outfit-image-fill] Magnific failed:', message)
      }
    }

    if (!generatedBuffer && hasEdenAIImageConfig()) {
      try {
        const { dataUrl, resourceUrl } = await generateEdenAIImage(prompt)
        const upload = dataUrlToUpload(dataUrl)
        generatedBuffer = upload.buffer
        generatedContentType = upload.contentType
        fallbackImageUrl = resourceUrl || dataUrl
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn('[outfit-image-fill] EdenAI failed:', message)
      }
    }

    if (!generatedBuffer) {
      const token = optionalEnv('POLLINATIONS_TOKEN')
      const params = new URLSearchParams({
        width: '512', height: '768',
        nologo: 'true', model: 'flux',
        seed: String(seed),
        ...(token ? { token } : {}),
      })

      // Fetch the image through our server (avoids client-side CORS)
      const polUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`
      const imgRes = await fetch(polUrl, { signal: AbortSignal.timeout(40000) })
      if (!imgRes.ok) throw new Error(`Image generation is busy right now — try again in a moment (${imgRes.status})`)
      generatedBuffer = Buffer.from(await imgRes.arrayBuffer())
      generatedContentType = imgRes.headers.get('content-type') || 'image/png'
      fallbackImageUrl = polUrl
    }

    // Upload to Supabase Storage so we have a stable, fast URL
    const storagePath = `generated/${outfit.source_id || outfitId}.png`

    const { error: uploadErr } = await supabase.storage
      .from('Outfits')
      .upload(storagePath, generatedBuffer, { contentType: generatedContentType, upsert: true })

    let imageUrl: string

    if (uploadErr) {
      // Storage upload failed — fall back to Pollinations URL directly
      console.warn('[outfit-image-fill] Storage upload failed:', uploadErr.message)
      imageUrl = fallbackImageUrl || ''
    } else {
      const { data: { publicUrl } } = supabase.storage.from('Outfits').getPublicUrl(storagePath)
      imageUrl = publicUrl
    }

    // Save URL back to the correct table so we don't regenerate next time
    if (source === 'excel' && outfit.id) {
      await supabase.from('excel_outfits').update({ image_url: imageUrl }).eq('id', outfit.id)
    } else if (source === 'db' && outfitId) {
      await supabase.from('outfits').update({ image_url: imageUrl }).eq('id', outfitId)
    }

    return NextResponse.json({ image_url: imageUrl })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    const name = err instanceof Error ? err.name : ''
    const friendly = (name === 'TimeoutError' || msg.toLowerCase().includes('aborted') || msg.toLowerCase().includes('timeout'))
      ? 'Styling is taking longer than usual — try again in a moment'
      : msg
    console.error('[outfit-image-fill]', msg)
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
