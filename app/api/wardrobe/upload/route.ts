import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { analyzeImageWithFallback, extractJSON } from '@/services/aiProviders'
import { requireEnv } from '@/lib/env'
import { rateLimit } from '@/lib/rateLimit'

function getSupabaseClients() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'the wardrobe upload route')
  const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'the wardrobe upload route')
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'the wardrobe upload route')
  return {
    supabaseUrl,
    supabaseAnonKey,
    supabase: createClient(supabaseUrl, supabaseServiceKey),
  }
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

const WARDROBE_PROMPT = `You are a fashion AI. Analyse this clothing image and return ONLY a raw JSON object (no markdown, no code blocks):
{
  "item_name": "short descriptive name e.g. 'White linen shirt', 'Black slim chinos', 'Chunky white sneakers'",
  "item_type": "one of: top, bottom, shoes, outerwear, accessory, full outfit",
  "pieces": ["every visible garment/accessory as a separate string, e.g. 'white linen shirt', 'black slim trousers', 'silver watch'"],
  "color": "primary colour name e.g. 'White', 'Navy', 'Olive'",
  "occasion": "one suitable occasion e.g. 'Office', 'Weekend', 'Wedding Guest'",
  "style_query": "a natural search query Elephante should use e.g. 'outfits to wear with white linen shirt', 'style black slim chinos for smart casual'"
}
Be specific about what is visible. If the image shows a full outfit, set item_type to "full outfit", make item_name a short outfit summary, and include every visible clothing item and accessory in pieces: tops, bottoms, shoes, outerwear, bags, hats, belts, watches, jewellery, eyewear, socks, and visible layering. Do not invent hidden items; only include what can be seen.`

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

function normalizePieces(value: unknown) {
  const seen = new Set<string>()
  return asStringArray(value).filter((piece) => {
    const normalized = piece.toLowerCase()
    if (['null', 'none', 'n/a', 'na'].includes(normalized) || normalized.includes('not visible') || normalized.includes('not shown')) return false
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

async function getAuthenticatedUserId(request: NextRequest, supabaseUrl: string, supabaseAnonKey: string) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await authClient.auth.getUser()

  if (error || !data.user) return null
  return data.user.id
}

function inferImageType(file: File) {
  const explicitType = file.type.toLowerCase()
  if (explicitType) return explicitType

  const name = file.name.toLowerCase()
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.heic')) return 'image/heic'
  if (name.endsWith('.heif')) return 'image/heif'
  return ''
}

function extensionForImageType(imageType: string) {
  if (imageType === 'image/png') return 'png'
  if (imageType === 'image/webp') return 'webp'
  if (imageType === 'image/heic') return 'heic'
  if (imageType === 'image/heif') return 'heif'
  return 'jpg'
}

function categoryFromItemType(itemType: string) {
  const normalized = itemType.toLowerCase().trim()
  if (normalized === 'bottom') return 'bottoms'
  if (normalized === 'shoe' || normalized === 'shoes') return 'shoes'
  if (normalized === 'outerwear') return 'outerwear'
  if (normalized === 'accessory' || normalized === 'accessories') return 'accessories'
  return 'tops'
}

async function handleAnalyze(request: NextRequest, userId: string, supabase: SupabaseClient) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  const imageType = inferImageType(file)
  if (!ALLOWED_IMAGE_TYPES.has(imageType)) {
    return NextResponse.json({ error: 'Please upload a JPG, PNG, WebP, or HEIC image.' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Image file is empty.' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Image must be 8MB or smaller.' }, { status: 400 })
  }

  const ext = extensionForImageType(imageType)
  const path = `${userId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('wardrobe')
    .upload(path, buffer, { contentType: imageType, upsert: false })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { data: { publicUrl } } = supabase.storage.from('wardrobe').getPublicUrl(path)

  let itemName = 'Clothing item'
  let itemType = 'top'
  let pieces: string[] = []
  let color = ''
  let occasion = ''
  let styleQuery = ''

  try {
    const { content } = await analyzeImageWithFallback(publicUrl, WARDROBE_PROMPT)
    const parsed = extractJSON(content)
    itemName = asString(parsed.item_name, itemName)
    itemType = asString(parsed.item_type, itemType)
    pieces = normalizePieces(parsed.pieces)
    color = asString(parsed.color, color)
    occasion = asString(parsed.occasion, occasion)
    styleQuery = asString(parsed.style_query, `outfits to wear with ${pieces.length ? pieces.join(', ') : itemName}`)
  } catch {
    styleQuery = `style this ${itemType}`
  }

  return NextResponse.json({
    image_url: publicUrl,
    storage_path: path,
    item_name: itemName,
    item_type: itemType,
    pieces,
    color,
    occasion,
    style_query: styleQuery,
    tags: [
      { id: 'color', label: color || 'Color' },
      { id: 'item_type', label: itemType || 'Type' },
      { id: 'occasion', label: occasion || 'Occasion' },
    ],
  })
}

async function handleConfirm(request: NextRequest, userId: string, supabase: SupabaseClient) {
  const body = await request.json()
  const imageUrl = typeof body?.image_url === 'string' ? body.image_url : ''
  const storagePath = typeof body?.storage_path === 'string' ? body.storage_path : ''
  const itemName = typeof body?.item_name === 'string' ? body.item_name : 'Clothing item'
  const itemType = typeof body?.item_type === 'string' ? body.item_type : 'top'
  const color = typeof body?.color === 'string' ? body.color : ''
  const occasion = typeof body?.occasion === 'string' ? body.occasion : ''
  const styleQuery = typeof body?.style_query === 'string' ? body.style_query : `style this ${itemType}`

  if (!imageUrl || !storagePath || !storagePath.startsWith(`${userId}/`)) {
    return NextResponse.json({ error: 'A valid wardrobe upload is required.' }, { status: 400 })
  }

  const { data: saved, error } = await supabase
    .from('closet_items')
    .insert({
      user_id: userId,
      category: categoryFromItemType(itemType),
      image_url: imageUrl,
      storage_path: storagePath,
      item_name: itemName,
      item_type: itemType,
      color,
      occasion,
      style_query: styleQuery,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Wardrobe save failed: ${error.message}`)
  }

  return NextResponse.json({
    wardrobe_id: saved?.id,
    image_url: imageUrl,
    item_name: itemName,
    item_type: itemType,
    color,
    occasion,
    style_query: styleQuery,
  })
}

export async function POST(request: NextRequest) {
  const { ok, retryAfter } = rateLimit(request, { limit: 10, window: 60 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many wardrobe uploads. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const { supabaseUrl, supabaseAnonKey, supabase } = getSupabaseClients()
    const userId = await getAuthenticatedUserId(request, supabaseUrl, supabaseAnonKey)
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return await handleConfirm(request, userId, supabase)
    }

    return await handleAnalyze(request, userId, supabase)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    console.error('[wardrobe/upload]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
