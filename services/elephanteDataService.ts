'use client'

import { supabase } from '@/lib/supabase'
import type { Outfit } from '@/types/outfit'
import type { Profile } from '@/types/profile'

interface ElephanteBootstrapData {
  displayName: string
  outfits: Outfit[]
  userBodyShape: string
  userGender: string
  userHeight: string
  userId: string
  userPalettes: string[]
  userSkinTone: string
  userStylePref: string
}

function mergeOutfitRows(outfitRows: Outfit[] | null, excelRows: Outfit[] | null): Outfit[] {
  const excelMap = new Map<string, Outfit>()
  for (const row of excelRows || []) {
    if (row.source_id) excelMap.set(row.source_id, row)
  }

  const merged = (outfitRows || []).map((outfit) => {
    const excel = outfit.outfit_code ? excelMap.get(outfit.outfit_code) : null
    return excel ? { ...excel, ...outfit, image_url: outfit.image_url || excel.image_url } : outfit
  })

  const usedSourceIds = new Set(
    (outfitRows || [])
      .map((outfit) => outfit.outfit_code)
      .filter((value): value is string => Boolean(value))
  )

  for (const excel of excelRows || []) {
    if (!excel.source_id || !usedSourceIds.has(excel.source_id)) {
      merged.push({ ...excel, _source: 'excel' })
    }
  }

  return merged
}

export async function fetchElephanteBootstrapData(): Promise<ElephanteBootstrapData | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: outfitRows }, { data: excelRows }, { data: profile }] = await Promise.all([
    supabase.from('outfits').select('*'),
    supabase.from('excel_outfits').select('id,source_id,style_category,color_scheme,colors,top_wear,bottom_wear,shoes,accessories,outerwear,occasions,when_to_wear,outfit_details,hex_colors,gender,image_url'),
    supabase.from('profiles').select('full_name, username, gender, skin_tone, preferred_palette, body_shape, height_category, style_preference').eq('id', user.id).single(),
  ])
  const typedProfile = profile as Profile | null

  return {
    displayName: typedProfile?.full_name || typedProfile?.username || user.email?.split('@')[0] || 'Member',
    outfits: mergeOutfitRows((outfitRows as Outfit[] | null) || null, (excelRows as Outfit[] | null) || null),
    userBodyShape: typedProfile?.body_shape || '',
    userGender: (typedProfile?.gender || 'male').toLowerCase(),
    userHeight: typedProfile?.height_category || '',
    userId: user.id,
    userPalettes: typedProfile?.preferred_palette
      ? typedProfile.preferred_palette.split(', ').map((value: string) => value.trim().toLowerCase())
      : [],
    userSkinTone: typedProfile?.skin_tone || '',
    userStylePref: typedProfile?.style_preference || '',
  }
}
