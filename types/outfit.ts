export type OutfitId = string | number

export interface ExcelOutfit {
  id: string
  source_id?: string | null
  image_url?: string | null
  outfit_name?: string | null
  outfit_code?: string | null
  style_category?: string | null
  color_scheme?: string | null
  colors?: string[] | string | null
  top_wear?: string | null
  bottom_wear?: string | null
  shoes?: string | null
  accessories?: string | null
  outerwear?: string | null
  occasions?: string | null
  when_to_wear?: string | null
  outfit_details?: string | null
  pro_tip?: string | null
  hex_colors?: string[] | string | null
  material_top?: string | null
  material_bottom?: string | null
  material_shoes?: string | null
  material_notes?: string | null
  brand?: string | null
  gender?: string | null
}

export interface DbOutfit {
  id: string | number
  image_url?: string | null
  outfit_code?: string | null
  style?: string | null
  aesthetic?: string | null
  top?: string | null
  pieces?: string[] | null
  colors?: string[] | null
  occasion?: string | null
  brand?: string | null
  skin_tones?: string[] | null
  key_colors?: string[] | null
}

export type OutfitSource = 'excel' | 'db'

export type Outfit = Partial<ExcelOutfit & DbOutfit> & {
  id: OutfitId
  _source?: OutfitSource
}

export interface GeneratedOutfitVariant {
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
  alternative?: GeneratedOutfitVariant | null
}

export interface GeneratedOutfitResult {
  outfit: GeneratedOutfitVariant | null
  image_url: string | null
  image_provider?: string | null
  alternative_image_url?: string | null
  alternative_image_provider?: string | null
}
