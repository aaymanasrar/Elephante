'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ParticleCanvas from '@/components/ParticleCanvas'
import LoadingSpinner from '@/components/LoadingSpinner'
import { filterOutfits, matchesAesthetic } from '@/lib/filterOutfits'
import { useRequireUser } from '@/hooks/useRequireUser'
import { getFriendlyDataError } from '@/lib/supabaseErrors'
import { canUseNextImage } from '@/lib/image'
import type { Outfit } from '@/types/outfit'
import type { Profile } from '@/types/profile'

const LIFESTYLE = [
  { id: 'Business Casual', label: 'Business Casual' },
  { id: 'Smart Casual', label: 'Smart Casual' },
]

const AESTHETICS = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'dark', label: 'Dark' },
  { id: 'pastel', label: 'Pastel' },
  { id: 'colorful', label: 'Vibrant' },
]

type SavedOutfitRow = {
  outfit_id?: string | number | null
  outfit_ref?: string | number | null
  source?: string | null
}

function ClosetImage({ outfit, label }: { outfit: Outfit; label: string }) {
  if (!outfit.image_url) return null

  if (canUseNextImage(outfit.image_url)) {
    return (
      <Image
        src={outfit.image_url}
        alt={label}
        fill
        unoptimized
        sizes="(max-width: 768px) 50vw, 33vw"
        className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
      />
    )
  }

  return (
    <img
      src={outfit.image_url}
      alt={label}
      className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
      loading="lazy"
    />
  )
}

export default function ClosetPage() {
  const router = useRouter()
  const { user, loading: userLoading, error: authError } = useRequireUser('/login')
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([])
  const [displayed, setDisplayed] = useState<Outfit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [activeLifestyles, setActiveLifestyles] = useState<string[]>([])
  const [activeAesthetics, setActiveAesthetics] = useState<string[]>([])
  const [userPalette, setUserPalette] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      setLoading(true)
      setError('')

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('skin_tone, preferred_palette')
          .eq('id', user.id)
          .single()

        if (profileError) {
          setError(getFriendlyDataError(profileError.message, 'We could not load your closet.'))
        }

        const profile = profileData as Pick<Profile, 'preferred_palette'> | null
        const palettes = profile?.preferred_palette
          ? profile.preferred_palette.split(',').map((value) => value.trim().toLowerCase())
          : []
        setUserPalette(palettes)

        const { data: savedRows, error: savedError } = await supabase
          .from('saved_outfits')
          .select('outfit_ref, source, outfit_id')
          .eq('user_id', user.id)

        if (savedError) {
          setError(getFriendlyDataError(savedError.message, 'We could not load your closet.'))
          setAllOutfits([])
          return
        }

        if (!savedRows?.length) {
          setAllOutfits([])
          return
        }

        const resolveSavedRef = (row: SavedOutfitRow) => {
          if (row.outfit_id) return String(row.outfit_id)
          if (row.outfit_ref) return String(row.outfit_ref)
          return null
        }

        // Resolve both current string refs and legacy numeric archive refs.
        const validRefs = [
          ...new Set(
            savedRows
              .map((row) => {
                return resolveSavedRef(row)
              })
              .filter((ref): ref is string => ref !== null)
          ),
        ]

        if (!validRefs.length) {
          setAllOutfits([])
          return
        }

        const numericRefs = validRefs
          .map((ref) => Number(ref))
          .filter((ref) => Number.isInteger(ref) && ref > 0)

        const [excelByIdResult, excelBySourceResult, legacyResult] = await Promise.all([
          numericRefs.length
            ? supabase.from('excel_outfits').select('*').in('id', numericRefs)
            : Promise.resolve({ data: null }),
          validRefs.length
            ? supabase.from('excel_outfits').select('*').in('source_id', validRefs)
            : Promise.resolve({ data: null }),
          numericRefs.length
            ? supabase.from('outfits').select('*').in('id', numericRefs)
            : Promise.resolve({ data: null }),
        ])

        const excelById = new Map<string, Outfit>()
        const excelBySourceId = new Map<string, Outfit>()
        for (const outfit of ((excelByIdResult.data as Outfit[] | null) || [])) {
          excelById.set(String(outfit.id), { ...outfit, _source: 'excel' as const })
          if (outfit.source_id) excelBySourceId.set(String(outfit.source_id), { ...outfit, _source: 'excel' as const })
        }
        for (const outfit of ((excelBySourceResult.data as Outfit[] | null) || [])) {
          if (outfit.source_id) excelBySourceId.set(String(outfit.source_id), { ...outfit, _source: 'excel' as const })
        }

        const legacyById = new Map<string, Outfit>()
        for (const outfit of ((legacyResult.data as Outfit[] | null) || [])) {
          const richOutfit = outfit.outfit_code ? excelBySourceId.get(String(outfit.outfit_code)) : null
          legacyById.set(String(outfit.id), {
            ...(richOutfit || {}),
            ...outfit,
            image_url: outfit.image_url || richOutfit?.image_url,
            _source: richOutfit ? 'excel' as const : 'db' as const,
          })
        }

        const allSaved: Outfit[] = []
        const seen = new Set<string>()
        for (const row of savedRows as SavedOutfitRow[]) {
          const ref = resolveSavedRef(row)
          if (!ref || seen.has(ref)) continue

          const shouldPreferExcel = row.source === 'excel' || row.source === 'ai_stylist'
          const outfit = shouldPreferExcel
            ? excelById.get(ref) || excelBySourceId.get(ref) || legacyById.get(ref)
            : legacyById.get(ref) || excelById.get(ref) || excelBySourceId.get(ref)
          if (!outfit) continue

          allSaved.push(outfit)
          seen.add(ref)
        }

        setAllOutfits(allSaved)
      } catch {
        setError('We could not load your closet.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  useEffect(() => {
    setDisplayed(filterOutfits({
      outfits: allOutfits,
      activeLifestyles,
      activeAesthetics,
      searchQuery,
      userPalette,
    }))
  }, [activeAesthetics, activeLifestyles, allOutfits, searchQuery, userPalette])

  useEffect(() => {
    if (!searchQuery) {
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timer = setTimeout(() => setIsSearching(false), 700)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const pillBase = 'flex-shrink-0 px-4 py-2 rounded-full border text-[10px] uppercase tracking-widest font-semibold transition-all duration-300 whitespace-nowrap min-h-[36px] flex items-center'
  const pillOn = 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]'
  const pillOff = 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <ParticleCanvas />

      <div className="relative z-20 flex items-center justify-between px-5 pt-8 sm:pt-10 pb-3">
        <button
          onClick={() => router.back()}
          className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors min-h-[44px] flex items-center"
          aria-label="Go back"
        >
          ← Back
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.4em] text-zinc-500 uppercase">
          Closet
        </h1>
        <div className="w-10" />
      </div>

      <div className="relative z-20 px-4 space-y-2 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          <span className="flex-shrink-0 text-[9px] uppercase tracking-widest text-zinc-700 self-center pr-1">Style</span>
          {LIFESTYLE.map((lifestyle) => (
            <button
              key={lifestyle.id}
              onClick={() => setActiveLifestyles((previous) => previous.includes(lifestyle.id) ? previous.filter((value) => value !== lifestyle.id) : [...previous, lifestyle.id])}
              className={`${pillBase} ${activeLifestyles.includes(lifestyle.id) ? pillOn : pillOff}`}
            >
              {lifestyle.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          <span className="flex-shrink-0 text-[9px] uppercase tracking-widest text-zinc-700 self-center pr-1">Color</span>
          {AESTHETICS.map((aesthetic) => (
            <button
              key={aesthetic.id}
              onClick={() => setActiveAesthetics((previous) => previous.includes(aesthetic.id) ? previous.filter((value) => value !== aesthetic.id) : [...previous, aesthetic.id])}
              className={`${pillBase} ${activeAesthetics.includes(aesthetic.id) ? pillOn : pillOff}`}
            >
              {aesthetic.label}
              {userPalette.includes(aesthetic.id) ? <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block" /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-20 px-4 pb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search — wedding, office, white shirt, suit..."
            aria-label="Search saved outfits"
            className="w-full bg-zinc-900/80 border border-zinc-800 text-white placeholder-zinc-700 text-sm rounded-2xl py-3 pl-5 pr-10 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
          />
          {isSearching ? (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : null}
          {searchQuery && !isSearching ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 px-4 pb-32">
        {loading || userLoading ? (
          <div className="py-32">
            <LoadingSpinner text="Loading Closet..." />
          </div>
        ) : error || authError ? (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-red-400 text-[11px] text-center">{error || authError}</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-zinc-800 text-[10px] uppercase tracking-[0.4em]">
              {searchQuery ? 'No matching looks' : 'No saved outfits'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-zinc-700 text-[9px] uppercase tracking-widest mb-4">
              {displayed.length} look{displayed.length !== 1 ? 's' : ''}
              {(activeLifestyles.length > 0 || activeAesthetics.length > 0) ? ' · filtered' : ''}
              {userPalette.length > 0 && activeAesthetics.length === 0 ? ' · sorted by your aesthetic' : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {displayed.map((outfit, index) => {
                const label = outfit.style_category || outfit.outfit_name || outfit.style || 'Outfit'
                const hexes = Array.isArray(outfit.hex_colors)
                  ? outfit.hex_colors
                  : Array.isArray(outfit.key_colors)
                    ? outfit.key_colors
                    : []
                const pieces = [outfit.top_wear, outfit.bottom_wear, outfit.shoes].filter(Boolean)
                const hasData = !outfit.image_url && (label || hexes.length > 0 || pieces.length > 0)

                return (
                  <div
                    key={String(outfit.id || index)}
                    className="group cursor-pointer"
                    onClick={() => router.push(`/outfit/${outfit.id}`)}
                  >
                    <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/40 group-hover:border-zinc-600 transition-all duration-500">
                      {outfit.image_url ? (
                        <>
                          <ClosetImage outfit={outfit} label={label} />
                          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <p className="text-[9px] uppercase tracking-widest text-zinc-300 truncate">{label}</p>
                          </div>
                        </>
                      ) : hasData ? (
                        <div className="w-full h-full flex flex-col justify-between p-3">
                          {hexes.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {hexes.slice(0, 5).map((hex, colorIndex) => (
                                <div key={`${hex}-${colorIndex}`} className="w-4 h-4 rounded-full border border-zinc-800 flex-shrink-0" style={{ backgroundColor: hex }} />
                              ))}
                            </div>
                          ) : null}
                          <div className="flex-1 flex flex-col justify-center gap-1.5 py-2">
                            <p className="text-[10px] text-white font-light leading-tight line-clamp-2">{label}</p>
                            {pieces.map((piece, pieceIndex) => (
                              <p key={`${piece}-${pieceIndex}`} className="text-[9px] text-zinc-600 leading-snug truncate">{piece}</p>
                            ))}
                          </div>
                          <p className="text-[8px] uppercase tracking-[0.3em] text-zinc-800">
                            {userPalette.some((palette) => matchesAesthetic(outfit, palette)) ? 'Saved Look' : 'AI Look'}
                          </p>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-800 text-[9px] uppercase tracking-widest">
                          No image
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
