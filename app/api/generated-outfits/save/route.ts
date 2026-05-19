import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthClients } from '@/app/api/auth/_utils'
import { buildGeneratedOutfitRow } from '@/lib/generatedOutfitRow'
import { rateLimit } from '@/lib/rateLimit'
import type { GeneratedOutfitVariant } from '@/types/outfit'

type SaveType = 'primary' | 'alternative'
type SavedOutfitSource = 'excel' | 'ai_stylist' | 'manual'

type SaveRequestBody = {
  type?: SaveType
  source?: SavedOutfitSource
  outfit?: GeneratedOutfitVariant & { alternative?: GeneratedOutfitVariant | null }
  primaryOutfit?: GeneratedOutfitVariant | null
  image_url?: string | null
  alternative_image_url?: string | null
}

type SavedGeneratedOutfit = {
  id: string
  type: SaveType
  image_url: string | null
}

const GENERATED_BUCKET = process.env.GENERATED_OUTFITS_BUCKET || 'Outfits'

function asSaveType(value: unknown): SaveType | null {
  return value === 'primary' || value === 'alternative' ? value : null
}

function asSavedOutfitSource(value: unknown): SavedOutfitSource {
  return value === 'excel' || value === 'manual' || value === 'ai_stylist' ? value : 'ai_stylist'
}

function slugPart(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80)
}

function extensionForContentType(contentType: string) {
  const lower = contentType.toLowerCase()
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg'
  if (lower.includes('webp')) return 'webp'
  if (lower.includes('gif')) return 'gif'
  return 'png'
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/)
  if (!match?.[2]) return null

  return {
    buffer: Buffer.from(match[2].replace(/\s/g, ''), 'base64'),
    contentType: match[1] || 'image/png',
  }
}

async function imageToUpload(imageUrl: string) {
  const trimmed = imageUrl.trim()
  const dataUrl = parseDataUrl(trimmed)
  if (dataUrl) return dataUrl

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Generated image URL is not valid.')
  }

  const response = await fetch(trimmed, { signal: AbortSignal.timeout(45_000) })
  if (!response.ok) throw new Error(`Could not download generated image (${response.status}).`)

  const contentType = response.headers.get('content-type') || 'image/png'
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error('Generated image URL did not return an image.')
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  }
}

function isMissingBucketError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() || ''
  return message.includes('bucket') && (message.includes('not found') || message.includes('does not exist'))
}

async function uploadGeneratedImage(
  supabase: SupabaseClient,
  imageUrl: string | null | undefined,
  options: { userId: string; sourceKey: string; type: SaveType },
) {
  if (!imageUrl?.trim()) return null

  const upload = await imageToUpload(imageUrl)
  const ext = extensionForContentType(upload.contentType)
  const path = `${options.userId}/generated/${slugPart(options.sourceKey)}_${options.type}.${ext}`

  let { error } = await supabase.storage
    .from(GENERATED_BUCKET)
    .upload(path, upload.buffer, {
      contentType: upload.contentType,
      upsert: true,
    })

  if (isMissingBucketError(error)) {
    await supabase.storage.createBucket(GENERATED_BUCKET, { public: true }).catch(() => null)
    ;({ error } = await supabase.storage
      .from(GENERATED_BUCKET)
      .upload(path, upload.buffer, {
        contentType: upload.contentType,
        upsert: true,
      }))
  }

  if (error) throw new Error(`Generated image storage failed: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage.from(GENERATED_BUCKET).getPublicUrl(path)
  return publicUrl
}

async function getUserIdFromRequest(req: NextRequest, authClient: SupabaseClient) {
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null

  const { data, error } = await authClient.auth.getUser(authorization.slice('Bearer '.length))
  if (error || !data.user) return null
  return data.user.id
}

function isDuplicateRowError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || ''
  return error?.code === '23505' || message.includes('duplicate key')
}

async function saveOutfitToCloset(supabase: SupabaseClient, userId: string, outfitRef: string, source: SavedOutfitSource) {
  const { data: existing, error: lookupError } = await supabase
    .from('saved_outfits')
    .select('id, source')
    .eq('user_id', userId)
    .eq('outfit_ref', outfitRef)
    .maybeSingle()

  if (lookupError) throw new Error(`Closet lookup failed: ${lookupError.message}`)
  if (existing?.id) {
    if (existing.source !== source) {
      const { error: updateError } = await supabase
        .from('saved_outfits')
        .update({ source })
        .eq('id', existing.id)

      if (updateError) throw new Error(`Closet source update failed: ${updateError.message}`)
    }
    return
  }

  const { error: savedError } = await supabase
    .from('saved_outfits')
    .insert({
      user_id: userId,
      outfit_ref: outfitRef,
      source,
    })

  if (savedError && !isDuplicateRowError(savedError)) {
    throw new Error(`Closet save failed: ${savedError.message}`)
  }
}

async function saveOneGeneratedOutfit(
  supabase: SupabaseClient,
  userId: string,
  generated: GeneratedOutfitVariant,
  options: {
    type: SaveType
    primaryOutfit: GeneratedOutfitVariant
    imageUrl: string | null | undefined
    sourceKey: string
    closetSource: SavedOutfitSource
    primaryOutfitRef?: string | number | null
  },
): Promise<SavedGeneratedOutfit> {
  const stableImageUrl = await uploadGeneratedImage(supabase, options.imageUrl, {
    userId,
    sourceKey: options.sourceKey,
    type: options.type,
  })

  const row = {
    ...buildGeneratedOutfitRow(generated, {
      isAlternative: options.type === 'alternative',
      primaryOutfit: options.primaryOutfit,
      imageUrl: stableImageUrl,
      sourceKey: options.sourceKey,
    }),
    primary_outfit_ref: options.primaryOutfitRef ? Number(options.primaryOutfitRef) : null,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('excel_outfits')
    .insert(row)
    .select('id, image_url')
    .single()

  if (insertError || !inserted?.id) {
    throw new Error(`Generated outfit save failed: ${insertError?.message || 'missing inserted id'}`)
  }

  const outfitRef = String(inserted.id)
  await saveOutfitToCloset(supabase, userId, outfitRef, options.closetSource)

  return {
    id: outfitRef,
    type: options.type,
    image_url: inserted.image_url || stableImageUrl,
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many save requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  try {
    const { authClient, serviceClient } = getAuthClients('generated outfit save')
    const userId = await getUserIdFromRequest(req, authClient)
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await req.json() as SaveRequestBody
    if (!body.outfit) return NextResponse.json({ error: 'Generated outfit is required.' }, { status: 400 })

    const sourceKey = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const requestedType = asSaveType(body.type)
    const closetSource = asSavedOutfitSource(body.source)
    const closetSourceKey = `${closetSource}_${sourceKey}`

    if (requestedType) {
      const primaryOutfit = body.primaryOutfit || body.outfit
      const imageUrl = requestedType === 'alternative' ? body.alternative_image_url || body.image_url : body.image_url
      const saved = await saveOneGeneratedOutfit(serviceClient, userId, body.outfit, {
        type: requestedType,
        primaryOutfit,
        imageUrl,
        sourceKey: `${closetSourceKey}_${requestedType}`,
        closetSource,
      })

      return NextResponse.json({ saved: [saved] })
    }

    const primary = body.outfit
    const savedPrimary = await saveOneGeneratedOutfit(serviceClient, userId, primary, {
      type: 'primary',
      primaryOutfit: primary,
      imageUrl: body.image_url,
      sourceKey: closetSourceKey,
      closetSource,
    })

    const saved: SavedGeneratedOutfit[] = [savedPrimary]

    if (primary.alternative) {
      saved.push(await saveOneGeneratedOutfit(serviceClient, userId, primary.alternative, {
        type: 'alternative',
        primaryOutfit: primary,
        imageUrl: body.alternative_image_url,
        sourceKey: closetSourceKey,
        closetSource,
        primaryOutfitRef: savedPrimary.id,
      }))
    }

    return NextResponse.json({ saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save generated outfit.'
    console.error('[generated-outfits/save]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
