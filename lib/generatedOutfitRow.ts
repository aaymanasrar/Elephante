interface GeneratedOutfitLike {
  outfit_name?: string | null
  style?: string | null
  color_scheme?: string | null
  top_wear?: string | null
  bottom_wear?: string | null
  shoes?: string | null
  accessories?: string | null
  outerwear?: string | null
  occasions?: string | null
  when_to_wear?: string | null
  outfit_details?: string | null
  skin_tone_analysis?: string | null
  skin_tone_reason?: string | null
  pro_tip?: string | null
  material_top?: string | null
  material_bottom?: string | null
  material_shoes?: string | null
  key_colors?: string[] | null
  gender?: string | null
  brand?: string | null
}

function normalizeOptionalText(value?: string | null) {
  return value && value !== 'null' && value !== 'None' ? value : null
}

export function buildGeneratedOutfitRow(
  generated: GeneratedOutfitLike,
  options: {
    isAlternative: boolean
    primaryOutfit: GeneratedOutfitLike
    imageUrl: string | null | undefined
    sourceKey: string
  }
) {
  const { isAlternative, primaryOutfit, imageUrl, sourceKey } = options
  const detailParts = [
    !isAlternative && primaryOutfit.outfit_details,
    !isAlternative && primaryOutfit.skin_tone_analysis && `Skin tone: ${primaryOutfit.skin_tone_analysis}`,
    isAlternative && generated.skin_tone_reason,
    !isAlternative && primaryOutfit.pro_tip && `Pro tip: ${primaryOutfit.pro_tip}`,
  ].filter(Boolean).join('\n\n')

  return {
    source_id: `ai_${sourceKey}_${isAlternative ? 'alt' : 'primary'}`,
    style_category: generated.outfit_name || generated.style || 'Custom Outfit',
    color_scheme: generated.color_scheme || '',
    top_wear: generated.top_wear || null,
    bottom_wear: generated.bottom_wear || null,
    shoes: generated.shoes || null,
    accessories: normalizeOptionalText(generated.accessories),
    outerwear: normalizeOptionalText(generated.outerwear),
    occasions: generated.occasions || primaryOutfit.occasions || null,
    when_to_wear: generated.when_to_wear || primaryOutfit.when_to_wear || null,
    outfit_details: detailParts || null,
    material_top: !isAlternative ? (primaryOutfit.material_top || null) : null,
    material_bottom: !isAlternative ? (primaryOutfit.material_bottom || null) : null,
    material_shoes: !isAlternative ? (primaryOutfit.material_shoes || null) : null,
    hex_colors: generated.key_colors || null,
    image_url: imageUrl || null,
    gender: primaryOutfit.gender || 'male',
    brand: generated.brand || null,
  }
}
