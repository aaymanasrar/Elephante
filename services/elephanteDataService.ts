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
  userAvatarUrl: string
}

export async function fetchElephanteBootstrapData(): Promise<ElephanteBootstrapData | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: outfitRows }, { data: profile }] = await Promise.all([
    supabase.from('outfits').select('*'),
    supabase.from('profiles').select('full_name, username, gender, skin_tone, preferred_palette, body_shape, height_category, style_preference, avatar_url').eq('id', user.id).single(),
  ])
  const typedProfile = profile as Profile | null

  return {
    displayName: typedProfile?.full_name || typedProfile?.username || user.email?.split('@')[0] || 'Member',
    outfits: (outfitRows as Outfit[] | null) || [],
    userBodyShape: typedProfile?.body_shape || '',
    userGender: (typedProfile?.gender || 'male').toLowerCase(),
    userHeight: typedProfile?.height_category || '',
    userId: user.id,
    userPalettes: typedProfile?.preferred_palette
      ? typedProfile.preferred_palette.split(', ').map((value: string) => value.trim().toLowerCase())
      : [],
    userSkinTone: typedProfile?.skin_tone || '',
    userStylePref: typedProfile?.style_preference || '',
    userAvatarUrl: typedProfile?.avatar_url || '',
  }
}
