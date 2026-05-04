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

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

const WARDROBE_PROMPT = `You are a fashion AI. Analyse this clothing image and return ONLY a raw JSON object (no markdown, no code blocks):
{
  "item_name": "short descriptive name e.g. 'White linen shirt', 'Black slim chinos', 'Chunky white sneakers'",
  "item_type": "one of: top, bottom, shoes, outerwear, accessory, full outfit",
  "color": "primary colour name e.g. 'White', 'Navy', 'Olive'",
  "occasion": "one suitable occasion e.g. 'Office', 'Weekend', 'Wedding Guest'",
  "style_query": "a natural search query Elephante should use e.g. 'outfits to wear with white linen shirt', 'style black slim chinos for smart casual'"
}
Be specific about the garment. If it's a full outfit, describe the main pieces briefly in item_name.`

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

function extensionForFile(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
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
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Please upload a JPG, PNG, or WebP image.' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Image must be 8MB or smaller.' }, { status: 400 })
  }

  const ext = extensionForFile(file)
  const path = `${userId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('wardrobe')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { data: { publicUrl } } = supabase.storage.from('wardrobe').getPublicUrl(path)

  let itemName = 'Clothing item'
  let itemType = 'top'
  let color = ''
  let occasion = ''
  let styleQuery = ''

  try {
    const { content } = await analyzeImageWithFallback(publicUrl, WARDROBE_PROMPT)
    const parsed = extractJSON(content)
    itemName = parsed.item_name || itemName
    itemType = parsed.item_type || itemType
    color = parsed.color || color
    occasion = parsed.occasion || occasion
    styleQuery = parsed.style_query || `outfits to wear with ${itemName}`
  } catch {
    styleQuery = `style this ${itemType}`
  }

  return NextResponse.json({
    image_url: publicUrl,
    storage_path: path,
    item_name: itemName,
    item_type: itemType,
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
