'use client'

import { useState } from 'react'
import type { OutfitCard } from '@/hooks/useAiSearchFlow'

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

const PIECE_ICONS: Record<string, string> = {
  top: 'T',
  bottom: 'B',
  shoes: 'S',
  outerwear: 'O',
  accessories: 'A',
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
  const [expanded, setExpanded] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
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
    hideDetails: 'إخفاء',
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
    hideDetails: 'Hide',
  }

  const pieceLabels: Record<string, string> = {
    top: copy.top,
    bottom: copy.bottom,
    shoes: copy.shoes,
    outerwear: copy.outerwear,
    accessories: copy.accessories,
  }

  const handleGenerateImage = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setGenerating(true)
    setImgError('')
    try {
      const query = [
        `Generate a ${card.style} outfit`,
        `for ${card.occasion}`,
        `— ${card.pieces.top}, ${card.pieces.bottom}, ${card.pieces.shoes}`,
        card.pieces.outerwear ? `, ${card.pieces.outerwear}` : '',
        card.pieces.accessories ? `, ${card.pieces.accessories}` : '',
        `. Color palette: ${card.color_scheme}`,
      ].join('')

      const res = await fetch('/api/outfit-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          gender: userGender,
          skin_tone: userSkinTone,
          body_shape: userBodyShape,
          height: userHeight,
          style_pref: userStylePref,
          language,
        }),
      })
      const data = await res.json()
      if (data.error) { setImgError(copy.imageError); return }
      setImageUrl(data.image_url || null)
    } catch {
      setImgError(copy.imageError)
    } finally {
      setGenerating(false)
    }
  }

  const validPieces = Object.entries(card.pieces).filter(([, value]) => value && value !== 'null')
  const validColors = (card.key_colors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c))

  return (
    <div
      className="w-full rounded-2xl bg-zinc-950/70 border border-white/8 overflow-hidden"
      style={{ opacity: 0, animation: `cardIn 0.4s ease forwards`, animationDelay: `${index * 80}ms` }}
    >
      {/* Generated image */}
      {imageUrl ? (
        <div className="relative w-full aspect-[3/4] bg-zinc-900">
          <img src={imageUrl} alt={card.outfit_name} className="w-full h-full object-cover object-top" />
          <button
            onClick={handleGenerateImage}
            disabled={generating}
            className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/70 border border-white/15 text-[9px] uppercase tracking-[0.18em] text-zinc-300 hover:text-white hover:border-white/30 transition-all disabled:opacity-50"
          >
            {generating ? copy.generating : copy.regenerate}
          </button>
        </div>
      ) : null}

      <div className="p-4 space-y-3" dir={isAr ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-[13px] font-medium leading-snug truncate">{card.outfit_name}</h3>
            <p className="text-zinc-500 text-[10px] mt-0.5 truncate">{card.style}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {validColors.length > 0 ? (
              <div className="flex gap-1">
                {validColors.slice(0, 4).map((hex, i) => (
                  <div
                    key={`${hex}-${i}`}
                    className="w-3.5 h-3.5 rounded-full border border-zinc-700/60 flex-shrink-0"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            ) : null}
            <span className="text-zinc-600 text-[9px] uppercase tracking-widest">{card.vibe}</span>
          </div>
        </div>

        {/* Cultural note */}
        {card.cultural_note ? (
          <div className="px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
            <p className="text-[10px] text-zinc-400 leading-snug">
              <span className="text-zinc-600 uppercase tracking-widest text-[8px] mr-1">{copy.culturalNote} ·</span>
              {card.cultural_note}
            </p>
          </div>
        ) : null}

        {/* Pieces */}
        <div className="space-y-1.5">
          <p className="text-[8px] uppercase tracking-[0.28em] text-zinc-600">{copy.pieces}</p>
          {validPieces.map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center bg-zinc-900 text-zinc-600 text-[8px] font-mono uppercase mt-0.5">
                {PIECE_ICONS[key] || (key[0] ?? '?').toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-zinc-600 text-[9px] uppercase tracking-widest mr-1.5">{pieceLabels[key]}</span>
                <span className="text-zinc-300 text-[11px] leading-snug">{value as string}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Generate image button */}
        {!imageUrl ? (
          <button
            onClick={handleGenerateImage}
            disabled={generating}
            className="w-full py-2.5 rounded-xl bg-white text-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-3 h-3 border border-black/20 border-t-black/80 rounded-full animate-spin" />
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
        ) : null}

        {imgError ? (
          <p className="text-red-400 text-[10px] text-center">{imgError}</p>
        ) : null}

        {/* Expandable details */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between text-zinc-600 hover:text-zinc-400 transition-colors pt-1"
        >
          <span className="text-[9px] uppercase tracking-[0.22em]">{expanded ? copy.hideDetails : copy.details}</span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {expanded ? (
          <div className="space-y-3 pt-1 border-t border-zinc-900 animate-in fade-in duration-200">
            <div>
              <p className="text-[8px] uppercase tracking-[0.28em] text-zinc-600 mb-1">{copy.whyItWorks}</p>
              <p className="text-zinc-400 text-[11px] leading-relaxed">{card.why_it_works}</p>
            </div>
            {card.styling_tip ? (
              <div>
                <p className="text-[8px] uppercase tracking-[0.28em] text-zinc-600 mb-1">{copy.stylingTip}</p>
                <p className="text-zinc-400 text-[11px] leading-relaxed">{card.styling_tip}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[8px] uppercase tracking-[0.28em] text-zinc-600 mb-1">Palette</p>
              <p className="text-zinc-500 text-[11px] leading-relaxed">{card.color_scheme}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
