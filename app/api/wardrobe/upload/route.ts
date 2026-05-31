import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { analyzeImageWithFallback, extractJSON } from '@/services/aiProviders'
import { requireEnv } from '@/lib/env'
import { rateLimit } from '@/lib/rateLimit'
import { prettifyWardrobeImage } from '@/lib/wardrobeImage'
import { extractDominantColors } from '@/lib/colorAnalysis'
import { classifyFashionItem, hasRenderOnnxConfig } from '@/lib/renderOnnxServer'

export const runtime = 'nodejs'

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
  "item_type": "MUST be exactly one of these values: top | bottom | shoes | outerwear | accessory | full outfit | thobe | bisht | abaya | keffiyeh | agal",
  "pieces": ["every visible garment/accessory as a separate string"],
  "color": "primary colour name e.g. 'White', 'Navy', 'Olive'",
  "material": "dominant fabric/material if visible e.g. 'cotton poplin', 'denim', 'leather', otherwise empty string",
  "pattern": "visible pattern e.g. 'solid', 'pinstripe', 'plaid', 'floral', otherwise 'solid'",
  "season": "best season e.g. 'Spring', 'Summer', 'Fall', 'Winter', or 'Year-round'",
  "formality": "one of: casual | smart casual | business casual | formal | black tie",
  "brand_visible": "brand name only if clearly visible, otherwise empty string",
  "occasion": "one suitable occasion e.g. 'Office', 'Weekend', 'Wedding Guest', 'Eid', 'Ramadan', 'Majlis', 'Formal', 'Casual'",
  "style_query": "a natural search query e.g. 'outfits to wear with white linen shirt'"
}

Category rules — use EXACTLY these values:
- "top": shirts, t-shirts, blouses, polos, sweaters, hoodies, tank tops, crop tops, dress shirts, tunics
- "bottom": pants, trousers, jeans, chinos, shorts, skirts, leggings, joggers, sweatpants, culottes
- "shoes": all footwear — sneakers, boots, heels, sandals, loafers, oxfords, slippers
- "outerwear": jackets, coats, blazers, suits, sport coats, vests, cardigans worn as outerwear
- "accessory": bags, belts, hats, caps, watches, jewellery, scarves, pocket squares, cufflinks, sunglasses, ties
- "full outfit": complete head-to-toe look with multiple garments visible
- "thobe": men's full-length robe (Thobe / Kandura / Dishdasha)
- "bisht": formal ceremonial cloak worn over thobe
- "abaya": women's full-length robe
- "keffiyeh": head covering (Keffiyeh / Ghitra / Shemagh)
- "agal": black cord worn on head covering

If multiple images are provided, the first is the original upload; prefer it for accuracy. Do not invent hidden items.`

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

function parseWardrobeAnalysis(parsed: Record<string, unknown>) {
  const itemName = asString(parsed.item_name, 'Clothing item')
  const itemType = asString(parsed.item_type, 'top')
  const pieces = normalizePieces(parsed.pieces)
  const color = asString(parsed.color)
  const material = asString(parsed.material)
  const pattern = asString(parsed.pattern)
  const season = asString(parsed.season)
  const formality = asString(parsed.formality)
  const brandVisible = asString(parsed.brand_visible)
  const occasion = asString(parsed.occasion)
  const styleQuery = asString(parsed.style_query, `outfits to wear with ${pieces.length ? pieces.join(', ') : itemName}`)

  return {
    itemName,
    itemType,
    pieces,
    color,
    material,
    pattern,
    season,
    formality,
    brandVisible,
    occasion,
    styleQuery,
  }
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

async function uploadWardrobeImage(
  supabase: SupabaseClient,
  path: string,
  buffer: Buffer,
  contentType: string,
) {
  const { error } = await supabase.storage
    .from('wardrobe')
    .upload(path, buffer, { contentType, upsert: false })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  const { data: { publicUrl } } = supabase.storage.from('wardrobe').getPublicUrl(path)
  return publicUrl
}

function categoryFromItemType(itemType: string) {
  const n = itemType.toLowerCase().trim()

  if (n === 'bottom' || n === 'bottoms' ||
      ['pant', 'trouser', 'jean', 'chino', 'short', 'skirt', 'legging', 'jogger', 'sweatpant', 'culotte'].some(t => n.includes(t)))
    return 'bottoms'

  if (n === 'shoe' || n === 'shoes' ||
      ['sneaker', 'boot', 'heel', 'sandal', 'loafer', 'oxford', 'slipper', 'footwear'].some(t => n.includes(t)))
    return 'shoes'

  if (n === 'outerwear' || n === 'bisht' || n === 'abaya' || n === 'thobe' ||
      ['jacket', 'coat', 'blazer', 'suit', 'vest', 'cardigan', 'overcoat', 'windbreaker', 'parka'].some(t => n.includes(t)))
    return 'outerwear'

  if (n === 'accessory' || n === 'accessories' || n === 'keffiyeh' || n === 'agal' ||
      ['bag', 'belt', 'hat', 'cap', 'watch', 'jewel', 'scarf', 'pocket square', 'cufflink', 'sunglass', 'tie', 'purse', 'wallet'].some(t => n.includes(t)))
    return 'accessories'

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
  const timestamp = Date.now()
  const originalPath = `${userId}/wardrobe/original/${timestamp}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const originalPublicUrl = await uploadWardrobeImage(supabase, originalPath, buffer, imageType)

  let itemName = 'Clothing item'
  let itemType = 'top'
  let pieces: string[] = []
  let color = ''
  let material = ''
  let pattern = ''
  let season = ''
  let formality = ''
  let brandVisible = ''
  let occasion = ''
  let styleQuery = ''
  let analysisProvider = ''

  const analyzeUpload = async (images: string | string[]) => {
    const result = await analyzeImageWithFallback(images, WARDROBE_PROMPT)
    const parsed = extractJSON(result.content) as Record<string, unknown>
    const analysis = parseWardrobeAnalysis(parsed)
    itemName = analysis.itemName
    itemType = analysis.itemType
    pieces = analysis.pieces
    color = analysis.color
    material = analysis.material
    pattern = analysis.pattern
    season = analysis.season
    formality = analysis.formality
    brandVisible = analysis.brandVisible
    occasion = analysis.occasion
    styleQuery = analysis.styleQuery
    analysisProvider = result.provider
  }

  try {
    await analyzeUpload(originalPublicUrl)
  } catch {
    styleQuery = `style this ${itemType}`
  }

  try {
    if (hasRenderOnnxConfig()) {
      const detection = await classifyFashionItem(originalPublicUrl)
      if (detection.item_type && detection.confidence >= 0.25) itemType = detection.item_type
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[wardrobe/upload] clothing classifier failed:', message)
  }

  let path: string
  let publicUrl: string
  let imageAiEdited = false
  let imageProvider = ''

  try {
    const prettified = await prettifyWardrobeImage(buffer, userId, {
      itemName,
      itemType,
      pieces,
      subjectHint: [itemName, itemType, color, material, pattern].filter(Boolean).join(', '),
    })
    const cleanPath = `${userId}/wardrobe/clean/${timestamp}.${prettified.extension}`
    publicUrl = await uploadWardrobeImage(supabase, cleanPath, prettified.buffer, prettified.contentType)
    path = cleanPath
    imageAiEdited = prettified.aiEdited
    imageProvider = prettified.provider
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[wardrobe/upload] image prettify failed:', message)
    await supabase.storage.from('wardrobe').remove([originalPath]).catch(() => null)
    return NextResponse.json({ error: message }, { status: 422 })
  }

  if (!pieces.length || itemName === 'Clothing item') {
    try {
      await analyzeUpload([originalPublicUrl, publicUrl])
    } catch {
      styleQuery = styleQuery || `style this ${itemType}`
    }
  }

  // Enhance the color field with dominant colors from the uploaded image.
  // Run with a 5-second timeout so it never blocks the response.
  if (publicUrl) {
    try {
      const colorPromise = extractDominantColors(publicUrl, 5)
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000))
      const dominantColors = await Promise.race([colorPromise, timeoutPromise])
      if (dominantColors && dominantColors.length > 0 && color.length < 20) {
        const topNames = dominantColors.slice(0, 3).map((c) => c.name)
        const combined = color
          ? [color, ...topNames.filter((n) => n.toLowerCase() !== color.toLowerCase())]
          : topNames
        color = combined.slice(0, 3).join(', ')
      }
    } catch {
      // Color enhancement is best-effort — ignore failures
    }
  }

  return NextResponse.json({
    image_url: publicUrl,
    storage_path: path,
    original_image_url: originalPublicUrl,
    original_storage_path: originalPath,
    image_prettified: true,
    image_ai_edited: imageAiEdited,
    image_provider: imageProvider,
    analysis_provider: analysisProvider,
    item_name: itemName,
    item_type: itemType,
    pieces,
    color,
    material,
    pattern,
    season,
    formality,
    brand_visible: brandVisible,
    occasion,
    style_query: styleQuery,
    tags: [
      { id: 'color', label: color || 'Color' },
      { id: 'item_type', label: itemType || 'Type' },
      { id: 'material', label: material || 'Material' },
      { id: 'pattern', label: pattern || 'Pattern' },
      { id: 'formality', label: formality || 'Formality' },
      { id: 'occasion', label: occasion || 'Occasion' },
    ],
  })
}

async function safeInsertClosetItem(supabase: SupabaseClient, payload: Record<string, unknown>) {
  const currentPayload = { ...payload }
  
  while (true) {
    const { data, error } = await supabase
      .from('closet_items')
      .insert(currentPayload)
      .select('id')
      .single()
      
    if (error) {
      const match = error.message.match(/Could not find the '([^']+)' column/i)
      if (match && match[1]) {
        const missingColumn = match[1]
        console.warn(`[safeInsertClosetItem] Column '${missingColumn}' not in schema cache. Removing and retrying...`)
        delete currentPayload[missingColumn]
        continue
      }
      
      if (error.code === '42703') {
        const colMatch = error.message.match(/column \"([^\"]+)\" of relation/i) || error.message.match(/column \"([^\"]+)\" does not exist/i)
        if (colMatch && colMatch[1]) {
          const missingColumn = colMatch[1]
          console.warn(`[safeInsertClosetItem] Postgres column '${missingColumn}' does not exist. Removing and retrying...`)
          delete currentPayload[missingColumn]
          continue
        }
      }
      
      return { data: null, error }
    }
    
    return { data, error: null }
  }
}

async function handleConfirm(request: NextRequest, userId: string, supabase: SupabaseClient) {
  const body = await request.json()
  const imageUrl = typeof body?.image_url === 'string' ? body.image_url : ''
  const storagePath = typeof body?.storage_path === 'string' ? body.storage_path : ''
  const itemName = typeof body?.item_name === 'string' ? body.item_name : 'Clothing item'
  const itemType = typeof body?.item_type === 'string' ? body.item_type : 'top'
  const color = typeof body?.color === 'string' ? body.color : ''
  const material = typeof body?.material === 'string' ? body.material : ''
  const pattern = typeof body?.pattern === 'string' ? body.pattern : ''
  const season = typeof body?.season === 'string' ? body.season : ''
  const formality = typeof body?.formality === 'string' ? body.formality : ''
  const brandVisible = typeof body?.brand_visible === 'string' ? body.brand_visible : ''
  const occasion = typeof body?.occasion === 'string' ? body.occasion : ''
  const styleQuery = typeof body?.style_query === 'string' ? body.style_query : `style this ${itemType}`
  const originalImageUrl = typeof body?.original_image_url === 'string' ? body.original_image_url : ''
  const originalStoragePath = typeof body?.original_storage_path === 'string' ? body.original_storage_path : ''
  const imageProvider = typeof body?.image_provider === 'string' ? body.image_provider : ''
  const imageAiEdited = Boolean(body?.image_ai_edited)
  const imagePrettified = body?.image_prettified !== false

  if (!imageUrl || !storagePath || !storagePath.startsWith(`${userId}/`)) {
    return NextResponse.json({ error: 'A valid wardrobe upload is required.' }, { status: 400 })
  }

  const { data: saved, error } = await safeInsertClosetItem(supabase, {
    user_id: userId,
    category: categoryFromItemType(itemType),
    image_url: imageUrl,
    storage_path: storagePath,
    original_image_url: originalImageUrl || null,
    original_storage_path: originalStoragePath || null,
    image_prettified: imagePrettified,
    image_ai_edited: imageAiEdited,
    image_provider: imageProvider || null,
    item_name: itemName,
    item_type: itemType,
    color,
    material,
    pattern,
    season,
    formality,
    brand: brandVisible,
    occasion,
    style_query: styleQuery,
  })

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
