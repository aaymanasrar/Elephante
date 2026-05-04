import { supabase } from '@/lib/supabase'
import { buildGeneratedOutfitRow } from '@/lib/generatedOutfitRow'
import type { GeneratedOutfitVariant } from '@/types/outfit'

interface AiStylistOutfitLike {
  outfit_name?: string
  style?: string
  color_scheme?: string
  occasion?: string
  why_it_works?: string
  styling_tip?: string
  key_colors?: string[]
  pieces?: {
    top?: { item?: string | null }
    bottom?: { item?: string | null }
    shoes?: { item?: string | null }
    outerwear?: { item?: string | null } | null
    accessories?: { item?: string | null }
  }
}

function normalizeOptionalText(value?: string | null) {
  return value && value !== 'None' && value !== 'null' ? value : null
}

export async function insertGeneratedOutfit(generated: GeneratedOutfitVariant | null | undefined, options: {
  type: 'primary' | 'alternative'
  primaryOutfit: GeneratedOutfitVariant | null | undefined
  imageUrl: string | null | undefined
}) {
  if (!generated) {
    return {
      data: null,
      error: new Error('Cannot insert an empty generated outfit.'),
    }
  }

  const row = buildGeneratedOutfitRow(generated, {
    isAlternative: options.type === 'alternative',
    primaryOutfit: options.primaryOutfit ?? generated,
    imageUrl: options.imageUrl,
    sourceKey: `${Date.now()}_${options.type}`,
  })

  return supabase
    .from('excel_outfits')
    .insert(row)
    .select('id')
    .single()
}

export async function insertGeneratedOutfitBatch(primaryOutfit: GeneratedOutfitVariant & { alternative?: GeneratedOutfitVariant | null }, options: {
  primaryImageUrl: string | null | undefined
  alternativeImageUrl?: string | null | undefined
}) {
  const sourceKey = String(Date.now())
  const rows: any[] = [buildGeneratedOutfitRow(primaryOutfit, {
    isAlternative: false,
    primaryOutfit,
    imageUrl: options.primaryImageUrl,
    sourceKey,
  })]

  if (primaryOutfit.alternative) {
    rows.push(buildGeneratedOutfitRow(primaryOutfit.alternative, {
      isAlternative: true,
      primaryOutfit,
      imageUrl: options.alternativeImageUrl,
      sourceKey,
    }))
  }

  return supabase
    .from('excel_outfits')
    .insert(rows)
    .select('id')
}

export async function saveAiStylistOutfit(outfit: AiStylistOutfitLike, userId: string, gender?: string | null) {
  const { data: inserted, error: insertErr } = await supabase
    .from('excel_outfits')
    .insert({
      source_id: `ai_stylist_${Date.now()}`,
      style_category: outfit.outfit_name || outfit.style || 'AI Look',
      color_scheme: outfit.color_scheme || '',
      top_wear: outfit.pieces?.top?.item || null,
      bottom_wear: outfit.pieces?.bottom?.item || null,
      shoes: outfit.pieces?.shoes?.item || null,
      outerwear: normalizeOptionalText(outfit.pieces?.outerwear?.item),
      accessories: normalizeOptionalText(outfit.pieces?.accessories?.item),
      occasions: outfit.occasion || null,
      outfit_details: [outfit.why_it_works, outfit.styling_tip].filter(Boolean).join('\n\n') || null,
      hex_colors: outfit.key_colors || null,
      gender: gender || 'male',
    })
    .select('id')
    .single()

  if (insertErr || !inserted?.id) {
    return { inserted: null, error: insertErr }
  }

  const { error: saveErr } = await supabase.from('saved_outfits').insert({
    user_id: userId,
    outfit_ref: inserted.id,
    source: 'excel',
  })

  return { inserted, error: saveErr }
}
