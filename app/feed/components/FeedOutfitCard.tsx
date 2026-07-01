'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { insertGeneratedOutfit } from '@/services/outfitService'
import type { OutfitCard, OutfitCardPieces } from '@/hooks/useAiSearchFlow'
import type { GeneratedOutfitVariant } from '@/types/outfit'
interface FeedOutfitCardProps {
  card: OutfitCard
  index: number
  userGender: string
  userSkinTone: string
  userBodyShape: string
  userHeight: string
  userStylePref: string
  language?: 'en' | 'ar'
  isAr?: boolean
}

const PIECE_ORDER: Array<keyof OutfitCardPieces> = [
  'top',
  'bottom',
  'shoes',
  'outerwear',
  'accessories',
]

function cleanText(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || ['null', 'none', 'n/a', 'na'].includes(trimmed.toLowerCase())) return null
  return trimmed
}

export default function FeedOutfitCard({
  card,
  index,
  userGender,
  userSkinTone,
  userBodyShape,
  userHeight,
  userStylePref,
  language = 'en',
  isAr = false,
}: FeedOutfitCardProps) {
  const router = useRouter()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [opening, setOpening] = useState(false)
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null)
  const [imgError, setImgError] = useState('')

  const copy = isAr ? {
    generateImage: 'توليد صورة الإطلالة',
    generating: 'جارٍ الإنشاء...',
    regenerate: 'إعادة الإنشاء',
    whyItWorks: 'لماذا تناسبك',
    stylingTip: 'نصيحة',
    culturalNote: 'ملاحظة ثقافية',
    pieces: 'القطع',
    top: 'علوي',
    bottom: 'سفلي',
    shoes: 'أحذية',
    outerwear: 'خارجي',
    accessories: 'إضافات',
    imageError: 'تعذّر إنشاء الصورة. حاول مرة أخرى.',
    details: 'التفاصيل',
    showDetails: 'عرض التفاصيل',
    hideDetails: 'إخفاء',
    openLook: 'فتح الإطلالة كاملة',
    opening: 'جارٍ الفتح...',
    openError: 'تعذّر فتح الإطلالة. حاول مرة أخرى.',
  } : {
    generateImage: 'Generate Outfit Image',
    generating: 'Generating...',
    regenerate: 'Regenerate',
    whyItWorks: 'Why it works for you',
    stylingTip: 'Styling tip',
    culturalNote: 'Cultural note',
    pieces: 'What to wear',
    top: 'Top',
    bottom: 'Bottom',
    shoes: 'Shoes',
    outerwear: 'Outerwear',
    accessories: 'Accessories',
    imageError: 'Could not generate image. Try again.',
    details: 'Details',
    showDetails: 'Show details',
    hideDetails: 'Hide',
    openLook: 'Open full look',
    opening: 'Opening...',
    openError: 'Could not open the full look. Try again.',
  }

  const pieceLabels: Record<string, string> = {
    top: copy.top,
    bottom: copy.bottom,
    shoes: copy.shoes,
    outerwear: copy.outerwear,
    accessories: copy.accessories,
  }

  const toGeneratedVariant = (): GeneratedOutfitVariant => {
    const hasBrands = card.brands && Object.values(card.brands).some(Boolean)
    return {
      outfit_name: card.outfit_name || 'Styled Look',
      style: card.style || null,
      color_scheme: card.color_scheme || null,
      top_wear: cleanText(card.pieces.top),
      bottom_wear: cleanText(card.pieces.bottom),
      shoes: cleanText(card.pieces.shoes),
      outerwear: cleanText(card.pieces.outerwear),
      accessories: cleanText(card.pieces.accessories),
      occasions: cleanText(card.occasion),
      outfit_details: [card.why_it_works, card.cultural_note].map(cleanText).filter(Boolean).join('\n\n') || null,
      pro_tip: cleanText(card.styling_tip),
      key_colors: card.key_colors || null,
      gender: userGender || 'male',
      brand: hasBrands ? JSON.stringify(card.brands) : null,
    }
  }

  const buildImageOutfitPayload = () => ({
    outfit_name: card.outfit_name,
    style: card.style,
    occasion: card.occasion,
    vibe: card.vibe,
    color_scheme: card.color_scheme,
    key_colors: card.key_colors,
    pieces: {
      top: { item: cleanText(card.pieces.top) },
      bottom: { item: cleanText(card.pieces.bottom) },
      shoes: { item: cleanText(card.pieces.shoes) },
      outerwear: cleanText(card.pieces.outerwear) ? { item: cleanText(card.pieces.outerwear) } : null,
      accessories: { item: cleanText(card.pieces.accessories) },
    },
  })

  const handleGenerateImage = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setGenerating(true)
    setImgError('')
    try {
      const res = await fetch('/api/generate-outfit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outfit: buildImageOutfitPayload(),
          profile: {
            gender: userGender,
            skin_tone: userSkinTone,
            body_shape: userBodyShape,
            height: userHeight,
            style_pref: userStylePref,
            language,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error || !data.image) {
        setImgError(typeof data.error === 'string' ? data.error : copy.imageError)
        return
      }
      setImageUrl(data.image)
      setSavedOutfitId(null)
    } catch {
      setImgError(copy.imageError)
    } finally {
      setGenerating(false)
    }
  }

  const handleOpenFullOutfit = async () => {
    if (!imageUrl || opening) return

    if (savedOutfitId) {
      router.push(`/outfit/${savedOutfitId}?from=feed`)
      return
    }

    setOpening(true)
    setImgError('')
    try {
      const outfit = toGeneratedVariant()
      const { data, error } = await insertGeneratedOutfit(outfit, {
        type: 'primary',
        primaryOutfit: outfit,
        imageUrl,
      })

      if (error) {
        if (/auth/i.test(error.message)) {
          router.push('/login')
          return
        }
        throw error
      }

      if (!data?.id) throw new Error('Missing outfit id')
      setSavedOutfitId(data.id)
      router.push(`/outfit/${data.id}?from=feed`)
    } catch {
      setImgError(copy.openError)
    } finally {
      setOpening(false)
    }
  }

  const handleViewFullLook = async () => {
    if (opening) return
    if (savedOutfitId) {
      router.push(`/outfit/${savedOutfitId}?from=feed`)
      return
    }
    setOpening(true)
    setImgError('')
    try {
      const outfit = toGeneratedVariant()
      const { data, error } = await insertGeneratedOutfit(outfit, {
        type: 'primary',
        primaryOutfit: outfit,
        imageUrl: imageUrl || null,
      })
      if (error) {
        if (/auth/i.test(error.message)) { router.push('/login'); return }
        throw error
      }
      if (!data?.id) throw new Error('Missing outfit id')
      setSavedOutfitId(data.id)
      router.push(`/outfit/${data.id}?from=feed`)
    } catch {
      setImgError(copy.openError)
    } finally {
      setOpening(false)
    }
  }

  const handleImageKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    void handleOpenFullOutfit()
  }

  const validPieces = PIECE_ORDER
    .map((key) => [key, cleanText(card.pieces[key])] as const)
    .filter((entry): entry is readonly [keyof OutfitCardPieces, string] => Boolean(entry[1]))
  const validColors = (card.key_colors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c))

  function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-1 h-1 rounded-full bg-zinc-700 flex-shrink-0" />
          <p className="text-[8px] uppercase tracking-[0.28em] text-zinc-600">{label}</p>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 backdrop-blur-sm overflow-hidden"
      style={{ opacity: 0, animation: `cardIn 0.4s ease forwards`, animationDelay: `${index * 80}ms` }}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800/40">
        {card.style ? <p className="text-[8px] uppercase tracking-[0.3em] text-zinc-600 mb-0.5">{card.style}</p> : null}
        {card.outfit_name ? <p className="text-sm font-medium text-white leading-snug">{card.outfit_name}</p> : null}
        {card.vibe ? <p className="text-[10px] text-zinc-500 mt-0.5 italic">{card.vibe}</p> : null}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Palette */}
        {validColors.length > 0 ? (
          <Section label="Palette">
            <div className="flex gap-2.5 flex-wrap pl-2.5">
              {validColors.map((hex, i) => (
                <div key={`${hex}-${i}`} className="flex flex-col items-center gap-1">
                  <div
                    className="w-7 h-7 rounded-full border border-zinc-700/60 shadow-sm"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                </div>
              ))}
            </div>
            {card.color_scheme ? <p className="text-[10px] text-zinc-500 mt-2 pl-2.5">{card.color_scheme}</p> : null}
          </Section>
        ) : null}

        {/* Pieces */}
        {validPieces.length > 0 ? (
          <Section label={copy.pieces}>
            <div className="divide-y divide-zinc-900/60 pl-2.5">
              {validPieces.map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 py-2 first:pt-1 last:pb-0">
                  <span className="text-[7px] text-zinc-700 font-mono uppercase w-3 shrink-0 select-none">
                    {key.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-[7px] text-zinc-500 uppercase tracking-[0.18em] w-[72px] shrink-0 whitespace-nowrap overflow-hidden">
                    {pieceLabels[key]}
                  </span>
                  <span className="text-[11px] text-zinc-300 flex-1 min-w-0 truncate" title={value}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {/* Image generation/display */}
        <div className="pt-2">
          {imageUrl ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => void handleOpenFullOutfit()}
              onKeyDown={handleImageKeyDown}
              aria-label={copy.openLook}
              className="group/image relative w-full aspect-square rounded-xl bg-zinc-900 cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-white/40 border border-zinc-800/50"
            >
              <img
                src={imageUrl}
                alt={card.outfit_name}
                className="w-full h-full object-cover object-top transition-transform duration-500 group-hover/image:scale-[1.02]"
                onError={() => {
                  setImageUrl(null)
                  setImgError(copy.imageError)
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover/image:opacity-100 group-focus-visible/image:opacity-100">
                <span className="inline-flex min-h-8 items-center rounded-full border border-white/15 bg-black/65 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white">
                  {opening ? copy.opening : copy.openLook}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerateImage(e); }}
                disabled={generating}
                className="absolute top-2 right-2 px-3 py-1.5 rounded-full bg-black/70 border border-white/15 text-[9px] uppercase tracking-[0.18em] text-zinc-300 hover:text-white hover:border-white/30 transition-all disabled:opacity-50"
              >
                {generating ? copy.generating : copy.regenerate}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateImage}
              disabled={generating}
              className="w-full py-2.5 rounded-full border border-zinc-700 bg-zinc-900/50 text-zinc-300 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
            >
              {generating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                  {copy.generating}
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  {copy.generateImage}
                </>
              )}
            </button>
          )}
          {imgError ? (
            <p className="text-red-400 text-[10px] text-center mt-2">{imgError}</p>
          ) : null}
        </div>

        {/* More → navigate to full outfit detail page */}
        <button
          onClick={() => void handleViewFullLook()}
          disabled={opening}
          className="mt-1 w-full py-2 rounded-full border border-zinc-800 text-zinc-600 text-[9px] font-semibold uppercase tracking-[0.3em] hover:border-zinc-600 hover:text-zinc-400 transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {opening ? (
            <><div className="w-2.5 h-2.5 border border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />{isAr ? 'جارٍ الفتح...' : 'Opening...'}</>
          ) : (
            <>{isAr ? 'المزيد' : 'More'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
