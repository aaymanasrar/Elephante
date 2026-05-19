import { NextRequest, NextResponse } from 'next/server'
import { getAuthClients } from '@/app/api/auth/_utils'
import { rateLimit } from '@/lib/rateLimit'
import { prettifyWardrobeImage } from '@/lib/wardrobeImage'
import { analyzeImageWithFallback, extractJSON } from '@/services/aiProviders'
import type { GeneratedOutfitVariant } from '@/types/outfit'

export const maxDuration = 300

const PHOTO_TO_OUTFIT_PROMPT = `You are Elephante's closet digitizer. Extract the outfit from the uploaded photo and convert it into fashion metadata.

Return ONLY a raw JSON object, no markdown and no code fences:
{
  "outfit_name": "short name for this exact uploaded look",
  "style": "style category",
  "occasions": "occasion1; occasion2",
  "when_to_wear": "brief seasonal or time context",
  "color_scheme": "1 short sentence describing the visible palette",
  "key_colors": ["#hexcode1", "#hexcode2", "#hexcode3"],
  "top_wear": "visible top garment with color, material, cut, and fit, or null if not visible",
  "bottom_wear": "visible bottom garment with color, material, cut, and fit, or null if not visible",
  "shoes": "visible shoes or null",
  "accessories": "visible accessories or null",
  "outerwear": "visible outerwear or null",
  "material_top": "top fabric if inferable, otherwise null",
  "material_bottom": "bottom fabric if inferable, otherwise null",
  "material_shoes": "shoe material if inferable, otherwise null",
  "pattern_notes": "visible patterns or prints across the clothing, otherwise null",
  "season": "best season or year-round suitability",
  "formality": "one of: casual | smart casual | business casual | formal | black tie",
  "brand_visible": "brand name only if clearly visible, otherwise null",
  "outfit_details": "2 sentences explaining what was extracted from the photo",
  "skin_tone_analysis": "1 sentence about the palette if skin is visible or profile is provided",
  "pro_tip": "one optional styling tip that preserves the original outfit",
  "alternative": null
}

Rules:
- Recreate the uploaded outfit faithfully. Do not redesign it.
- Include only visible clothing. Do not invent hidden garments.
- If the image has multiple people or outfits, use the main centered or most visible outfit.
- Use null for missing top, bottom, shoes, accessories, or outerwear.
- Keep garment descriptions concrete enough for reference: color, garment type, fabric, fit, length, and notable details.`

type RequestBody = {
  image_url?: string
  gender?: string | null
  skin_tone?: string | null
  body_shape?: string | null
  height?: string | null
  style_pref?: string | null
  language?: 'en' | 'ar'
}

type ImageUpload = {
  buffer: Buffer
  contentType: string
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeNullable(value: unknown) {
  const text = asString(value)
  if (!text) return null
  const normalized = text.toLowerCase()
  if (['null', 'none', 'n/a', 'na', 'not visible', 'not shown'].includes(normalized)) return null
  return text
}

function asHexArray(value: unknown) {
  if (!Array.isArray(value)) return null
  const colors = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => /^#[0-9a-f]{6}$/i.test(item))
    .slice(0, 6)
  return colors.length ? colors : null
}

function extensionForContentType(contentType: string) {
  const lower = contentType.toLowerCase()
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg'
  if (lower.includes('webp')) return 'webp'
  if (lower.includes('heic')) return 'heic'
  if (lower.includes('heif')) return 'heif'
  return 'png'
}

async function imageUrlToUpload(imageUrl: string): Promise<ImageUpload> {
  const dataMatch = imageUrl.match(/^data:([^;]+);base64,([\s\S]+)$/)
  if (dataMatch?.[2]) {
    return {
      buffer: Buffer.from(dataMatch[2].replace(/\s/g, ''), 'base64'),
      contentType: dataMatch[1] || 'image/png',
    }
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new Error('Uploaded image URL is not valid.')
  }

  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(45_000) })
  if (!response.ok) throw new Error(`Could not download uploaded image (${response.status}).`)

  const contentType = response.headers.get('content-type') || 'image/png'
  if (!contentType.toLowerCase().startsWith('image/')) throw new Error('Uploaded URL did not return an image.')

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  }
}

async function uploadClosetImportImage(
  supabase: ReturnType<typeof getAuthClients>['serviceClient'],
  userId: string,
  buffer: Buffer,
  contentType: string,
  filename: string,
) {
  const path = `${userId}/closet-import/${filename}`
  const { error } = await supabase.storage
    .from('wardrobe')
    .upload(path, buffer, { contentType, upsert: false })

  if (error) throw new Error(`Closet image upload failed: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage.from('wardrobe').getPublicUrl(path)
  return publicUrl
}

function normalizeOutfit(parsed: Record<string, unknown>, gender: string | null | undefined, fallbackText: string): GeneratedOutfitVariant {
  const top = normalizeNullable(parsed.top_wear)
  const bottom = normalizeNullable(parsed.bottom_wear)
  const shoes = normalizeNullable(parsed.shoes)
  const accessories = normalizeNullable(parsed.accessories)
  const outerwear = normalizeNullable(parsed.outerwear)
  const visiblePieces = [top, bottom, shoes, accessories, outerwear].filter(Boolean).join(', ')

  return {
    outfit_name: asString(parsed.outfit_name, 'Uploaded Closet Look'),
    style: asString(parsed.style, 'Closet Upload'),
    occasions: asString(parsed.occasions, 'Saved closet outfit'),
    when_to_wear: asString(parsed.when_to_wear, 'When you want to repeat this uploaded look'),
    color_scheme: asString(parsed.color_scheme, 'Palette extracted from the uploaded outfit photo.'),
    key_colors: asHexArray(parsed.key_colors),
    top_wear: top,
    bottom_wear: bottom,
    shoes,
    accessories,
    outerwear,
    material_top: normalizeNullable(parsed.material_top),
    material_bottom: normalizeNullable(parsed.material_bottom),
    material_shoes: normalizeNullable(parsed.material_shoes),
    outfit_details: asString(
      parsed.outfit_details,
      visiblePieces
        ? `Extracted from the uploaded outfit photo: ${visiblePieces}.`
        : fallbackText.slice(0, 500) || 'Extracted from the uploaded outfit photo.',
    ),
    skin_tone_analysis: asString(parsed.skin_tone_analysis),
    pro_tip: asString(parsed.pro_tip, 'Use this version as a clean closet reference for repeating the same look.'),
    gender: gender || 'male',
    alternative: null,
  }
}

async function getUserIdFromRequest(req: NextRequest) {
  const { authClient } = getAuthClients('closet outfit photo import')
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null

  const { data, error } = await authClient.auth.getUser(authorization.slice('Bearer '.length))
  if (error || !data.user) return null
  return data.user.id
}

async function safeBulkInsertClosetItems(supabase: any, inserts: any[]) {
  let currentInserts = inserts.map(item => ({ ...item }))
  
  while (true) {
    const { data, error } = await supabase
      .from('closet_items')
      .insert(currentInserts)
      .select('*')
      
    if (error) {
      const match = error.message.match(/Could not find the '([^']+)' column/i)
      if (match && match[1]) {
        const missingColumn = match[1]
        console.warn(`[safeBulkInsertClosetItems] Column '${missingColumn}' not in schema cache. Removing and retrying...`)
        currentInserts = currentInserts.map((item: any) => {
          const newItem = { ...item }
          delete newItem[missingColumn]
          return newItem
        })
        continue
      }
      
      if (error.code === '42703') {
        const colMatch = error.message.match(/column \"([^\"]+)\" of relation/i) || error.message.match(/column \"([^\"]+)\" does not exist/i)
        if (colMatch && colMatch[1]) {
          const missingColumn = colMatch[1]
          console.warn(`[safeBulkInsertClosetItems] Postgres column '${missingColumn}' does not exist. Removing and retrying...`)
          currentInserts = currentInserts.map((item: any) => {
            const newItem = { ...item }
            delete newItem[missingColumn]
            return newItem
          })
          continue
        }
      }
      
      return { data: null, error }
    }
    
    return { data, error: null }
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 8, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many outfit imports. Please wait a moment and try again.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await req.json() as RequestBody
    const imageUrl = asString(body.image_url)
    if (!imageUrl) return NextResponse.json({ error: 'An outfit photo is required.' }, { status: 400 })

    const responseLanguage = body.language === 'ar' ? 'Arabic' : 'English'
    const userProfile = [
      `Gender: ${body.gender || 'male'}`,
      body.skin_tone && `Skin tone: ${body.skin_tone}`,
      body.body_shape && `Body shape: ${body.body_shape}`,
      body.height && `Height: ${body.height}`,
      body.style_pref && `Style preference: ${body.style_pref}`,
    ].filter(Boolean).join('\n')

    const prompt = [
      PHOTO_TO_OUTFIT_PROMPT,
      `Write user-facing JSON string values in ${responseLanguage}.`,
      userProfile ? `User profile context:\n${userProfile}` : null,
    ].filter(Boolean).join('\n\n')

    const sourceUpload = await imageUrlToUpload(imageUrl)
    const { serviceClient } = getAuthClients('closet outfit photo import')
    const timestamp = Date.now()
    const originalExt = extensionForContentType(sourceUpload.contentType)
    const originalPublicUrl = await uploadClosetImportImage(
      serviceClient,
      userId,
      sourceUpload.buffer,
      sourceUpload.contentType,
      `original/${timestamp}.${originalExt}`,
    )

    // Analyze the original image first so we know what pieces to isolate
    const result = await analyzeImageWithFallback([originalPublicUrl], prompt)
    const parsed = extractJSON(result.content) as Record<string, unknown>
    const outfit = normalizeOutfit(parsed, body.gender, result.content)

    // Identify visible garments
    const top = outfit.top_wear
    const bottom = outfit.bottom_wear
    const shoes = outfit.shoes
    const outerwear = outfit.outerwear
    const accessories = outfit.accessories

    type PieceSpec = {
      category: 'tops' | 'bottoms' | 'shoes' | 'outerwear' | 'accessories'
      item_name: string
      item_type: string
      color: string
      material: string
      occasion: string
      style_query: string
      subjectHint: string
    }

    const pieceSpecs: PieceSpec[] = []
    if (top) pieceSpecs.push({
      category: 'tops', item_name: top, item_type: 'top',
      color: asString(parsed.color_scheme, 'Unknown'), material: asString(parsed.material_top),
      occasion: asString(parsed.occasions, 'Daily Wear'), style_query: `style this ${top}`,
      subjectHint: `only the top garment: ${top}. Exclude all other pieces, hangers, body, and background.`,
    })
    if (bottom) pieceSpecs.push({
      category: 'bottoms', item_name: bottom, item_type: 'bottom',
      color: asString(parsed.color_scheme, 'Unknown'), material: asString(parsed.material_bottom),
      occasion: asString(parsed.occasions, 'Daily Wear'), style_query: `style this ${bottom}`,
      subjectHint: `only the bottom garment: ${bottom}. Exclude all other pieces, hangers, body, and background.`,
    })
    if (shoes) pieceSpecs.push({
      category: 'shoes', item_name: shoes, item_type: 'shoes',
      color: asString(parsed.color_scheme, 'Unknown'), material: asString(parsed.material_shoes),
      occasion: asString(parsed.occasions, 'Daily Wear'), style_query: `style this ${shoes}`,
      subjectHint: `only the shoes: ${shoes}. Exclude all clothing, hangers, body, and background.`,
    })
    if (outerwear) pieceSpecs.push({
      category: 'outerwear', item_name: outerwear, item_type: 'outerwear',
      color: asString(parsed.color_scheme, 'Unknown'), material: asString(parsed.material_top),
      occasion: asString(parsed.occasions, 'Daily Wear'), style_query: `style this ${outerwear}`,
      subjectHint: `only the outerwear: ${outerwear}. Exclude all other pieces, hangers, body, and background.`,
    })
    if (accessories) pieceSpecs.push({
      category: 'accessories', item_name: accessories, item_type: 'accessories',
      color: asString(parsed.color_scheme, 'Unknown'), material: '',
      occasion: asString(parsed.occasions, 'Daily Wear'), style_query: `style this ${accessories}`,
      subjectHint: `only the accessory: ${accessories}. Exclude all clothing, hangers, body, and background.`,
    })

    // Prettify each piece individually in parallel — gives each piece its own isolated image
    const prettifyResults = await Promise.allSettled(
      pieceSpecs.map(async (spec) => {
        const result = await prettifyWardrobeImage(sourceUpload.buffer, userId, {
          itemType: spec.item_type,
          itemName: spec.item_name,
          subjectHint: spec.subjectHint,
        })
        const url = await uploadClosetImportImage(
          serviceClient, userId, result.buffer, result.contentType,
          `clean/${timestamp}_${spec.item_type}_${Math.random().toString(36).slice(2, 7)}.${result.extension}`,
        )
        return { url, provider: result.provider }
      })
    )

    const savedItems: any[] = []

    if (pieceSpecs.length > 0) {
      const inserts = pieceSpecs.map((item, i) => {
        const prettify = prettifyResults[i]
        const imageUrl = prettify?.status === 'fulfilled' ? prettify.value.url : originalPublicUrl
        const imageProvider = prettify?.status === 'fulfilled' ? prettify.value.provider : ''
        return {
          user_id: userId,
          category: item.category,
          item_name: item.item_name,
          item_type: item.item_type,
          color: item.color,
          material: item.material,
          pattern: asString(parsed.pattern_notes),
          season: asString(parsed.season),
          formality: asString(parsed.formality),
          brand: asString(parsed.brand_visible),
          occasion: item.occasion,
          style_query: item.style_query,
          image_url: imageUrl,
          original_image_url: originalPublicUrl,
          image_prettified: prettify?.status === 'fulfilled',
          image_provider: imageProvider,
        }
      })

      const { data, error: insertError } = await safeBulkInsertClosetItems(serviceClient, inserts)

      if (insertError) {
        throw new Error(`Failed to save items to closet: ${insertError.message}`)
      }
      if (data) {
        savedItems.push(...data)
      }
    }

    return NextResponse.json({
      status: 'complete',
      imported_items: savedItems,
      source_provider: result.provider,
      image_provider: result.provider,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not import outfit photo.'
    console.error('[closet/outfit-from-photo]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
