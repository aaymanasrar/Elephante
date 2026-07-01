'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LoadingScreen from '@/app/components/LoadingScreen'
import ParticleCanvas from '@/components/ParticleCanvas'
import { detectPieceBrand, getAesthetic } from '@/lib/brands'
import { getBrandShopLink, getCategoryBrandLink } from '@/lib/affiliates'
import type { Gender } from '@/lib/affiliates'
import { useRequireUser } from '@/hooks/useRequireUser'
import { canUseNextImage } from '@/lib/image'
import { getFriendlyDataError } from '@/lib/supabaseErrors'
import { useLocale } from '@/lib/locale-context'
import type { Outfit, OutfitSource } from '@/types/outfit'

function SectionLabel({ children, isAr = false }: { children: React.ReactNode; isAr?: boolean }) {
  return (
    <p
      className={`text-[9px] text-zinc-600 mb-4 flex items-center gap-3 ${isAr ? 'font-medium' : 'uppercase tracking-[0.3em]'}`}
      style={{ fontFamily: isAr ? 'var(--font-arabic, serif)' : 'inherit' }}
    >
      {children}
      <span className="flex-1 h-px bg-zinc-900" />
    </p>
  )
}

const outfitCopy = {
  en: {
    archive: 'Archive',
    notFound: 'Outfit not found',
    goBack: 'Go back',
    generating: 'Generating...',
    noImage: 'No Image',
    colourPalette: 'Colour Palette',
    occasions: 'Occasions',
    whenToWear: 'When to Wear',
    worksFor: 'Works for',
    pieces: 'The Pieces',
    materials: 'Materials',
    material: 'Material',
    notes: 'Notes',
    analysing: 'Analysing...',
    analyse: 'Analyse with AI',
    reanalyse: 'Re-analyse with AI',
    saved: 'Saved',
    detailsNotes: 'Details & Notes',
    proTip: 'Pro tip',
    processing: 'Processing...',
    savedToCloset: 'Saved to Closet',
    saveToCloset: 'Save to Closet',
    removeFromCloset: 'Remove from closet',
    spin360: '360 Garment',
    spinGenerate: 'Generate 360',
    spinGenerating: 'Building 360...',
    spinDrag: 'Drag to rotate',
    spinExperimental: 'Experimental garment-only spin. Back and side views are inferred.',
    spinRegenerate: 'Regenerate',
    spinUnavailable: 'Add outfit pieces before generating a 360 spin.',
    spinError: 'Could not build the 360 garment spin.',
    logWear: 'Log Wear',
    wearHistory: 'Wear History',
    wornTimes: (n: number) => n === 1 ? 'Worn 1 time' : `Worn ${n} times`,
    lastWorn: 'Last worn',
    neverWorn: 'Not worn yet',
    logWearError: 'Could not update wear history.',
  },
  ar: {
    archive: 'الأرشيف',
    notFound: 'لم يتم العثور على الإطلالة',
    goBack: 'رجوع',
    generating: 'جارٍ الإنشاء...',
    noImage: 'لا توجد صورة',
    colourPalette: 'لوحة الألوان',
    occasions: 'المناسبات',
    whenToWear: 'متى تلبسها',
    worksFor: 'تناسب',
    pieces: 'القطع',
    materials: 'المواد',
    material: 'المادة',
    notes: 'ملاحظات',
    analysing: 'جارٍ التحليل...',
    analyse: 'حلّل بالذكاء الاصطناعي',
    reanalyse: 'إعادة التحليل بالذكاء الاصطناعي',
    saved: 'محفوظة',
    detailsNotes: 'التفاصيل والملاحظات',
    proTip: 'نصيحة',
    processing: 'جارٍ المعالجة...',
    savedToCloset: 'محفوظة في الخزانة',
    saveToCloset: 'حفظ في الخزانة',
    removeFromCloset: 'إزالة من الخزانة',
    spin360: 'ملابس 360',
    spinGenerate: 'إنشاء 360',
    spinGenerating: 'جارٍ بناء 360...',
    spinDrag: 'اسحب للتدوير',
    spinExperimental: 'عرض تجريبي للملابس فقط. الجوانب والخلف مستنتجة.',
    spinRegenerate: 'إعادة الإنشاء',
    spinUnavailable: 'أضف تفاصيل القطع قبل إنشاء عرض 360.',
    spinError: 'تعذّر بناء عرض 360 للملابس.',
    logWear: 'سجّل ارتداء',
    wearHistory: 'تاريخ الارتداء',
    wornTimes: (n: number) => `ارتديت ${n} مرة`,
    lastWorn: 'آخر ارتداء',
    neverWorn: 'لم تُرتدَ بعد',
    logWearError: 'تعذّر تحديث تاريخ الارتداء.',
  },
} as const

const pieceLabels: Record<string, string> = {
  Top: 'الجزء العلوي',
  Bottom: 'الجزء السفلي',
  Shoes: 'الأحذية',
  Accessories: 'الإكسسوارات',
  Outerwear: 'الطبقة الخارجية',
  Extra: 'إضافة',
  Shoe: 'الحذاء',
}

const toneLabels: Record<string, string> = {
  'Light Skin': 'بشرة فاتحة',
  'Medium Skin': 'بشرة متوسطة',
  'Tan Skin': 'بشرة سمراء',
  'Dark Skin': 'بشرة داكنة',
}

function localLabel(label: string, isAr: boolean) {
  return isAr ? pieceLabels[label] || label : label
}

function localTone(label: string, isAr: boolean) {
  return isAr ? toneLabels[label] || label : label
}

const COLOR_HEX: Record<string, string> = {
  white: '#f5f5f5', cream: '#fffdd0', ivory: '#fffff0', 'off-white': '#faf9f6',
  black: '#1a1a1a', charcoal: '#36454f', 'dark grey': '#555', 'dark gray': '#555',
  navy: '#1b2a4a', blue: '#2563eb', cobalt: '#0047ab', 'royal blue': '#4169e1',
  'light blue': '#add8e6', 'sky blue': '#87ceeb', teal: '#008080',
  grey: '#9ca3af', gray: '#9ca3af', silver: '#c0c0c0', slate: '#708090',
  brown: '#795548', tan: '#d2b48c', camel: '#c19a6b', khaki: '#c3b091',
  beige: '#f5f0dc', sand: '#c2b280', nude: '#e3c0a6',
  green: '#16a34a', olive: '#6b7c45', forest: '#228b22', sage: '#bcb88a', emerald: '#50c878',
  red: '#dc2626', burgundy: '#800020', wine: '#722f37', maroon: '#800000',
  pink: '#ec4899', blush: '#de5d83', rose: '#ff007f', coral: '#ff7f7f',
  yellow: '#fbbf24', gold: '#d4af37', mustard: '#e1ad01', amber: '#ffbf00',
  orange: '#f97316', rust: '#b7410e', terracotta: '#e2725b',
  purple: '#7c3aed', lavender: '#e6e6fa', plum: '#8e4585', mauve: '#e0b0ff',
}

function colorToHex(name: string) {
  return COLOR_HEX[name.toLowerCase().trim()] || '#3f3f46'
}

function deriveTitle(outfit: Outfit, source: OutfitSource) {
  if (source === 'excel') return outfit.outfit_name || outfit.style_category || 'Archive Look'
  if (outfit.top?.trim()) return outfit.top
  if (outfit.aesthetic) {
    return outfit.aesthetic
      .replace(/^(male|female)\s+/i, '')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  if (outfit.outfit_code) return outfit.outfit_code
  return outfit.style || 'Archive Look'
}

function normalizeToneLabel(value: string) {
  const lower = value.toLowerCase()
  if (lower.includes('light') || lower.includes('fair')) return 'Light Skin'
  if (lower.includes('medium') || lower.includes('olive')) return 'Medium Skin'
  if (lower.includes('tan') || lower.includes('warm')) return 'Tan Skin'
  if (lower.includes('dark') || lower.includes('deep')) return 'Dark Skin'
  return `${value.replace(/\s*skin\s*$/i, '').trim()} Skin`
}

function deriveWorksFor(outfit: Outfit, colorScheme: string | null, hexColors: string[]) {
  if (Array.isArray(outfit.skin_tones) && outfit.skin_tones.length) {
    return Array.from(new Set(outfit.skin_tones.map(normalizeToneLabel)))
  }

  const text = [
    colorScheme,
    outfit.aesthetic,
    outfit.style,
    outfit.style_category,
    outfit.outfit_details,
    outfit.when_to_wear,
    outfit.colors,
    outfit.hex_colors,
  ].flat().filter(Boolean).join(' ').toLowerCase()

  if (/(pastel|soft|light|cream|ivory|white|pale|blush|sky|baby blue|lavender)/.test(text)) {
    return ['Light Skin', 'Medium Skin']
  }

  if (/(navy|cobalt|emerald|burgundy|wine|black|charcoal|deep|jewel|contrast)/.test(text)) {
    return ['Medium Skin', 'Tan Skin', 'Dark Skin']
  }

  if (/(earth|brown|camel|khaki|olive|tan|beige|warm|rust|terracotta)/.test(text)) {
    return ['Medium Skin', 'Tan Skin']
  }

  if (hexColors.length > 0) {
    return ['Light Skin', 'Medium Skin', 'Tan Skin', 'Dark Skin']
  }

  return ['Light Skin', 'Medium Skin']
}

interface AnalysisState {
  outfit_name?: string
  vibe?: string
  style?: string
  color_scheme?: string
  overall_verdict?: string
  silhouette_feedback?: string
  skin_tone_feedback?: string
  why_it_works?: string
  styling_tip?: string
  key_colors?: string[]
  pieces?: string[]
  color_names?: string[]
  occasions?: string[]
  occasion?: string
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\n/g, ' ').trim()
  }
}

function readJsonishString(raw: string, key: string) {
  const match = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`))
  return match?.[1] ? decodeJsonString(match[1]).trim() : ''
}

function readJsonishStringArray(raw: string, key: string) {
  const fieldStart = raw.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*)`))
  if (!fieldStart?.[1]) return []

  const body = fieldStart[1].split(/\]\s*,\s*"/)[0] || ''
  return Array.from(body.matchAll(/"((?:\\.|[^"\\])*)"/g))
    .map((match) => decodeJsonString(match[1] || '').trim())
    .filter(Boolean)
}

function isJsonishText(value?: string | null) {
  const trimmed = value?.trim() || ''
  return trimmed.startsWith('{') || trimmed.includes('"outfit_name"') || trimmed.includes('"why_it_works"')
}

function tryParseAnalysisText(value?: string | null): Partial<AnalysisState> | null {
  const trimmed = value?.trim()
  if (!trimmed || !isJsonishText(trimmed)) return null

  const parseCandidates = [
    trimmed,
    trimmed.match(/\{[\s\S]*\}/)?.[0],
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (parsed && typeof parsed === 'object') return parsed as Partial<AnalysisState>
    } catch {}
  }

  const recovered: Partial<AnalysisState> = {}
  for (const key of ['outfit_name', 'style', 'vibe', 'color_scheme', 'why_it_works', 'styling_tip', 'overall_verdict', 'silhouette_feedback', 'skin_tone_feedback'] as const) {
    const valueForKey = readJsonishString(trimmed, key)
    if (valueForKey) recovered[key] = valueForKey
  }

  const occasions = readJsonishStringArray(trimmed, 'occasions')
  const pieces = readJsonishStringArray(trimmed, 'pieces')
  const colorNames = readJsonishStringArray(trimmed, 'color_names')
  const keyColors = readJsonishStringArray(trimmed, 'key_colors').filter((hex) => /^#[0-9a-f]{6}$/i.test(hex))

  if (occasions.length) recovered.occasions = occasions
  if (pieces.length) recovered.pieces = pieces
  if (colorNames.length) recovered.color_names = colorNames
  if (keyColors.length) recovered.key_colors = keyColors

  return Object.keys(recovered).length ? recovered : null
}

function firstCleanText(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === 'string' && value.trim() && !isJsonishText(value))?.trim() || ''
}

function buildReadableDetails(analysis: Partial<AnalysisState>) {
  const direct = firstCleanText(analysis.why_it_works, analysis.overall_verdict)
  if (direct) return direct

  const parts = [
    firstCleanText(analysis.color_scheme),
    Array.isArray(analysis.occasions) && analysis.occasions.length
      ? `Works for ${analysis.occasions.slice(0, 3).join(', ')}.`
      : '',
    Array.isArray(analysis.pieces) && analysis.pieces.length
      ? `Visible pieces: ${analysis.pieces.slice(0, 4).join(', ')}.`
      : '',
  ].filter(Boolean)

  return parts.join(' ')
}

function normalizeAnalysisForDisplay(input: AnalysisState): AnalysisState {
  const parsed = tryParseAnalysisText(input.why_it_works) || tryParseAnalysisText(input.styling_tip)
  const merged = parsed ? { ...input, ...parsed } : input
  const readableDetails = buildReadableDetails(merged) || buildReadableDetails(input)
  const readableTip = firstCleanText(merged.styling_tip, input.styling_tip)

  return {
    ...merged,
    why_it_works: readableDetails || undefined,
    styling_tip: readableTip || undefined,
  }
}

// ─── NearbyStoreButton ───────────────────────────────────────────────────────
function NearbyStoreButton({ brand, isAr }: { brand: string; isAr: boolean }) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const coords = await new Promise<{ lat: number; lon: number }>((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('no geo')); return }
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          reject,
          { timeout: 6000, maximumAge: 300_000 }
        )
      })
      const res = await fetch(`/api/nearby-shops?lat=${coords.lat}&lon=${coords.lon}&radius=5000&brands=${encodeURIComponent(brand)}`)
      const data = await res.json()
      const shops: Array<{ mapsUrl: string; brandMatch?: string }> = data.shops || []
      const target = shops.find(s => s.brandMatch) || shops[0]
      if (target) {
        window.open(target.mapsUrl, '_blank', 'noopener,noreferrer')
      } else {
        window.open(`https://www.google.com/maps/search/${encodeURIComponent(brand + ' store')}/@${coords.lat},${coords.lon},14z`, '_blank', 'noopener,noreferrer')
      }
    } catch {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(brand + ' store near me')}`, '_blank', 'noopener,noreferrer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={() => void handleClick()}
      disabled={loading}
      title={isAr ? `أقرب متجر ${brand}` : `Nearest ${brand} store`}
      className="shrink-0 flex items-center gap-1 px-2.5 py-1 border border-zinc-800 rounded-full text-[9px] uppercase tracking-widest text-zinc-600 hover:border-amber-600/50 hover:text-amber-500 transition-all duration-200 active:scale-95 disabled:opacity-40"
    >
      {loading ? (
        <div className="w-2.5 h-2.5 border border-current/40 border-t-current rounded-full animate-spin" />
      ) : (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      )}
      {loading ? '...' : (isAr ? 'متجر' : 'Store')}
    </button>
  )
}

// ─── PriceHistoryGraph ────────────────────────────────────────────────────────
function PriceHistoryGraph({ history, currency }: {
  history: Array<{ price: number; checked_at: string }>
  currency: string
}) {
  if (history.length === 0) return (
    <p className="text-[10px] text-zinc-700 italic">Tracking started — price history will appear here after first check.</p>
  )

  const prices = history.map(h => h.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const W = 260, H = 56, PAD = 4

  const pts = history.map((h, i) => {
    const x = PAD + (i / Math.max(history.length - 1, 1)) * (W - PAD * 2)
    const y = H - PAD - ((h.price - min) / range) * (H - PAD * 2)
    return { x, y, price: h.price, date: new Date(h.checked_at).toLocaleDateString() }
  })

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const latest = pts[pts.length - 1]
  const oldest = pts[0]
  const dropped = latest && oldest && latest.price < oldest.price
  const color = dropped ? '#22c55e' : '#52525b'

  return (
    <div className="mt-2">
      <svg width={W} height={H} className="overflow-visible w-full">
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={i === pts.length - 1 ? color : '#27272a'} stroke={color} strokeWidth="1" />
        ))}
        {latest && (
          <text x={latest.x} y={latest.y - 6} fill={color} fontSize="8" textAnchor="middle" fontFamily="monospace">
            {currency}{latest.price.toFixed(0)}
          </text>
        )}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[8px] text-zinc-700">{pts[0]?.date}</span>
        {pts.length > 1 && <span className="text-[8px] text-zinc-700">{pts[pts.length - 1]?.date}</span>}
      </div>
    </div>
  )
}

// ─── OutfitPriceTracker ───────────────────────────────────────────────────────
interface WatchEntry {
  id: string
  product_url: string
  product_name: string
  brand: string | null
  current_price: number | null
  currency: string
  created_at: string
  price_history: Array<{ price: number; checked_at: string }>
}

function OutfitPriceTracker({ trackablePieces, userId, isAr }: {
  trackablePieces: Array<{ name: string; url: string; brand: string | null }>
  userId: string | undefined
  isAr: boolean
}) {
  const [watches, setWatches] = useState<WatchEntry[]>([])
  const [tracking, setTracking] = useState<Set<string>>(new Set())
  const [removing, setRemoving] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!userId) return
    fetch('/api/price-watch')
      .then(r => r.json())
      .then(data => { if (data.watches) setWatches(data.watches) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [userId])

  const isTracked = (url: string) => watches.some(w => w.product_url === url)

  const handleTrack = async (piece: { name: string; url: string; brand: string | null }) => {
    if (!userId || tracking.has(piece.url)) return
    setTracking(prev => new Set([...prev, piece.url]))
    try {
      const res = await fetch('/api/price-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_url: piece.url, product_name: piece.name, brand: piece.brand }),
      })
      const data = await res.json()
      if (data.watch) setWatches(prev => [{ ...data.watch, price_history: [] }, ...prev.filter(w => w.product_url !== piece.url)])
    } catch {}
    finally { setTracking(prev => { const s = new Set(prev); s.delete(piece.url); return s }) }
  }

  const handleRemove = async (watch: WatchEntry) => {
    if (removing.has(watch.id)) return
    setRemoving(prev => new Set([...prev, watch.id]))
    try {
      await fetch(`/api/price-watch?id=${watch.id}`, { method: 'DELETE' })
      setWatches(prev => prev.filter(w => w.id !== watch.id))
    } catch {}
    finally { setRemoving(prev => { const s = new Set(prev); s.delete(watch.id); return s }) }
  }

  if (!userId) return null

  const label = (k: string) => isAr ? k : k
  const trackedWatches = watches.filter(w => trackablePieces.some(p => p.url === w.product_url))

  return (
    <div className="mb-8" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.6s' }}>
      <p className={`text-[9px] text-zinc-600 mb-4 flex items-center gap-3 ${isAr ? 'font-medium' : 'uppercase tracking-[0.3em]'}`}>
        {isAr ? 'تتبع الأسعار' : 'Track Prices'}
        <span className="flex-1 h-px bg-zinc-900" />
      </p>

      {/* Untracked pieces */}
      <div className="space-y-2 mb-4">
        {trackablePieces.filter(p => !isTracked(p.url)).map(piece => (
          <div key={piece.url} className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-zinc-800/50 bg-zinc-950/40">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-zinc-400 truncate">{piece.name}</p>
              {piece.brand && <p className="text-[8px] text-zinc-700 uppercase tracking-wider mt-0.5">{piece.brand}</p>}
            </div>
            <button
              onClick={() => void handleTrack(piece)}
              disabled={tracking.has(piece.url)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 text-[9px] uppercase tracking-[0.2em] hover:border-white hover:text-white transition-all active:scale-95 disabled:opacity-40"
            >
              {tracking.has(piece.url) ? (
                <div className="w-2.5 h-2.5 border border-current/40 border-t-current rounded-full animate-spin" />
              ) : (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              )}
              {isAr ? 'تتبع' : 'Track'}
            </button>
          </div>
        ))}
      </div>

      {/* Tracked pieces with price graph */}
      {trackedWatches.map(watch => (
        <div key={watch.id} className="mb-4 p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-zinc-300 truncate">{watch.product_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {watch.brand && <span className="text-[8px] text-zinc-600 uppercase tracking-wider">{watch.brand}</span>}
                {watch.current_price != null && (
                  <span className="text-[9px] text-zinc-400 font-mono">{watch.currency}{watch.current_price.toFixed(2)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a href={watch.product_url} target="_blank" rel="noopener noreferrer" className="text-[8px] text-zinc-600 hover:text-zinc-400 uppercase tracking-wider transition-colors">
                ↗
              </a>
              <button
                onClick={() => void handleRemove(watch)}
                disabled={removing.has(watch.id)}
                className="text-zinc-700 hover:text-red-500 transition-colors text-[10px]"
                title={isAr ? 'إيقاف التتبع' : 'Stop tracking'}
              >
                ×
              </button>
            </div>
          </div>
          <PriceHistoryGraph
            history={(watch.price_history || []).slice().sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())}
            currency={watch.currency}
          />
          <p className="text-[8px] text-zinc-700 mt-2">
            {isAr ? 'منذ' : 'Tracking since'} {new Date(watch.created_at).toLocaleDateString()}
          </p>
        </div>
      ))}

      {loaded && trackablePieces.length === 0 && (
        <p className="text-[11px] text-zinc-700">{isAr ? 'لا توجد قطع لتتبع أسعارها.' : 'No pieces with shop links to track yet.'}</p>
      )}
    </div>
  )
}

interface NearbyShopItem {
  id: number
  name: string
  type: 'clothing' | 'tailor' | 'department' | 'shoes' | 'general' | 'brand_store'
  distanceM: number
  lat: number
  lon: number
  mapsUrl: string
  address?: string
  brandMatch?: string
}

function NearbyShopsSection({ brands, isAr }: { brands: string[]; isAr: boolean }) {
  const [shops, setShops] = useState<NearbyShopItem[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) { setDone(true); return }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords
        const brandsParam = brands.length ? `&brands=${encodeURIComponent(brands.join(','))}` : ''
        try {
          const res = await fetch(`/api/nearby-shops?lat=${lat}&lon=${lon}&radius=5000${brandsParam}`)
          const data = await res.json()
          if (Array.isArray(data.shops)) setShops(data.shops)
        } catch {}
        setLoading(false)
        setDone(true)
      },
      () => { setLoading(false); setDone(true) },
      { timeout: 8000, maximumAge: 300_000 }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!loading && !done) return null
  if (done && shops.length === 0) return null

  const shopIcon = (type: NearbyShopItem['type']) => {
    if (type === 'tailor') return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/>
        <path d="M8.12 8.12L12 12M12 12l3.88 3.88"/>
      </svg>
    )
    if (type === 'brand_store') return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/>
      </svg>
    )
  }

  const shopColor = (type: NearbyShopItem['type']) => {
    if (type === 'tailor') return 'bg-amber-950/60 text-amber-500'
    if (type === 'brand_store') return 'bg-zinc-800 text-zinc-300'
    return 'bg-zinc-800/60 text-zinc-500'
  }

  const fmtDist = (m: number) => m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`

  return (
    <div className="mb-8" style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.55s' }}>
      <p className={`text-[9px] text-zinc-600 mb-4 flex items-center gap-3 ${isAr ? 'font-medium' : 'uppercase tracking-[0.3em]'}`}>
        {isAr ? 'أين تشتري قريبًا' : 'Where to Buy Nearby'}
        <span className="flex-1 h-px bg-zinc-900" />
      </p>
      {loading ? (
        <div className="flex items-center gap-2 py-1">
          <div className="w-3 h-3 border border-zinc-800 border-t-zinc-600 rounded-full animate-spin" />
          <span className="text-[11px] text-zinc-600">{isAr ? 'جارٍ البحث...' : 'Finding nearby shops...'}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {shops.map(shop => (
            <a
              key={shop.id}
              href={shop.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-zinc-800/60 hover:border-zinc-600 hover:bg-zinc-900/40 transition-all group"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${shopColor(shop.type)}`}>
                {shopIcon(shop.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-zinc-200 truncate group-hover:text-white">{shop.name}</p>
                {shop.brandMatch ? (
                  <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 mt-0.5">{shop.brandMatch}</p>
                ) : shop.address ? (
                  <p className="text-[9px] text-zinc-600 mt-0.5">{shop.address}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[9px] text-zinc-600">{fmtDist(shop.distanceM)}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-700 group-hover:text-zinc-400 transition-colors">
                  <path d="M7 17L17 7M7 7h10v10" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function OutfitHeroImage({ outfit, title }: { outfit: Outfit; title: string }) {
  if (!outfit.image_url) return null

  if (canUseNextImage(outfit.image_url)) {
    return (
      <Image
        src={outfit.image_url}
        alt={title}
        fill
        unoptimized
        sizes="(max-width: 768px) 100vw, 480px"
        className="w-full h-full object-cover"
      />
    )
  }

  return <img src={outfit.image_url} alt={title} className="w-full h-full object-cover" loading="eager" />
}

export default function OutfitDetail() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAr } = useLocale()
  const t = isAr ? outfitCopy.ar : outfitCopy.en
  const { user } = useRequireUser('/login')
  const outfitId = params?.id as string

  const [outfit, setOutfit] = useState<Outfit | null>(null)
  const [source, setSource] = useState<OutfitSource>('db')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [dataSaved, setDataSaved] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [arabicTranslations, setArabicTranslations] = useState<Record<string, string>>({})
  const closetSection = searchParams.get('closetSection')
  const fromFeed = searchParams.get('from') === 'feed'
  const closetBackHref = !fromFeed && (closetSection === 'personal' || closetSection === 'stylist' || closetSection === 'curated')
    ? `/closet?section=${closetSection}`
    : null

  const handleBack = () => {
    if (closetBackHref) {
      router.push(closetBackHref)
      return
    }
    router.back()
  }



  const tr = (value: string | null | undefined) => {
    if (!value) return value || ''
    return isAr ? arabicTranslations[value] || value : value
  }

  useEffect(() => {
    if (!outfitId) return

    const fetchOutfit = async () => {
      try {
        setLoading(true)
        setFetchError(null)

        const [{ data: excelData }, { data: authData }] = await Promise.all([
          supabase.from('excel_outfits').select('*').eq('id', outfitId).maybeSingle(),
          supabase.auth.getUser(),
        ])

        if (excelData) {
          setOutfit(excelData as Outfit)
          setSource('excel')
        } else {
          const { data: dbData, error: dbError } = await supabase.from('outfits').select('*').eq('id', outfitId).maybeSingle()
          if (!dbData) {
            setFetchError(getFriendlyDataError(dbError?.message, 'Outfit not found'))
            setLoading(false)
            return
          }

          const typedDb = dbData as Outfit
          const hasEmptyFields = !typedDb.top && (!typedDb.pieces || typedDb.pieces.length === 0)
          if (hasEmptyFields && typedDb.outfit_code) {
            const { data: richData } = await supabase.from('excel_outfits').select('*').eq('source_id', typedDb.outfit_code).maybeSingle()
            if (richData) {
              setOutfit({ ...(richData as Outfit), image_url: typedDb.image_url, outfit_code: typedDb.outfit_code })
              setSource('excel')
            } else {
              setOutfit(typedDb)
              setSource('db')
            }
          } else {
            setOutfit(typedDb)
            setSource('db')
          }
        }

        if (authData.user) {
          const { data: savedData } = await supabase
            .from('saved_outfits')
            .select('id')
            .eq('user_id', authData.user.id)
            .or(`outfit_ref.eq.${outfitId},outfit_id.eq.${outfitId}`)
            .maybeSingle()

          setSaved(Boolean(savedData))
        }
      } catch {
        setFetchError('Outfit not found')
      } finally {
        setLoading(false)
      }
    }

    fetchOutfit()
  }, [outfitId])

  useEffect(() => {
    if (!outfit || outfit.image_url) return
    const hasPieces = outfit.top_wear || outfit.top || (Array.isArray(outfit.pieces) && outfit.pieces.length)
    if (!hasPieces) return

    setGeneratingImage(true)
    fetch('/api/outfit-image-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outfit, outfitId, source }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.image_url) {
          setOutfit((previous) => previous ? { ...previous, image_url: data.image_url } : previous)
        }
      })
      .catch(() => {})
      .finally(() => setGeneratingImage(false))
  }, [outfit, outfitId, source])

  useEffect(() => {
    if (!outfit?.image_url || !outfit.id) return

    const existing = outfit.hex_colors
    const hasColors = Array.isArray(existing)
      ? existing.length > 0
      : typeof existing === 'string' && existing.length > 2
    if (hasColors) return

    fetch('/api/analyze-outfit-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: outfit.image_url }),
    })
      .then((response) => response.json())
      .then(async (data) => {
        const realColors = data.analysis?.key_colors as string[] | undefined
        if (!realColors?.length) return
        setOutfit((previous) => previous ? { ...previous, hex_colors: realColors } : previous)

        if (source === 'excel') {
          await supabase.from('excel_outfits').update({ hex_colors: realColors }).eq('id', outfit.id)
        }
      })
      .catch(() => {})
  }, [outfit, source])

  useEffect(() => {
    if (!isAr || !outfit) {
      setArabicTranslations({})
      return
    }

    const rawOccasions = source === 'excel' ? outfit.occasions : outfit.occasion
    const occasionTexts = rawOccasions
      ? rawOccasions.split(/[|;,]/).map((value) => value.trim()).filter(Boolean)
      : []
    const aesthetic = getAesthetic((source === 'excel' ? outfit.color_scheme ?? null : null) || null, outfit.aesthetic || null)

    const texts = [
      deriveTitle(outfit, source),
      source === 'excel' ? outfit.style_category : outfit.style,
      source === 'excel' ? outfit.color_scheme : null,
      source === 'excel' ? outfit.when_to_wear : null,
      aesthetic?.label,
      ...occasionTexts,
      ...(Array.isArray(outfit.colors) ? outfit.colors : []),
      ...(source === 'excel' ? [
        outfit.top_wear,
        outfit.bottom_wear,
        outfit.shoes,
        outfit.accessories,
        outfit.outerwear,
        outfit.material_top,
        outfit.material_bottom,
        outfit.material_shoes,
        outfit.material_notes,
      ] : []),
      ...(Array.isArray(outfit.pieces) ? outfit.pieces : []),
      outfit.top,
      analysis?.outfit_name,
      analysis?.vibe,
      analysis?.style,
      analysis?.color_scheme,
      analysis?.why_it_works,
      analysis?.styling_tip,
    ].flat().filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    if (texts.length === 0) return

    const controller = new AbortController()
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'ar', texts }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.translations && typeof data.translations === 'object') {
          setArabicTranslations(data.translations)
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[translate outfit]', error)
      })

    return () => controller.abort()
  }, [isAr, outfit, source, analysis])

  const handleAnalyse = async () => {
    if (!outfit?.image_url) return
    setAnalysing(true)
    setAnalysisError('')
    setAnalysis(null)
    setDataSaved(false)

    try {
      const details = source === 'excel' ? outfit.outfit_details : null
      const response = await fetch('/api/analyze-outfit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: outfit.image_url, outfit_details: details }),
      })
      const data = await response.json()
      if (data.error) {
        setAnalysisError(data.error)
        return
      }

      const nextAnalysis = normalizeAnalysisForDisplay(data.analysis as AnalysisState)
      setAnalysis(nextAnalysis)

      if (source === 'db' && outfit.id) {
        const isEmpty = (value: unknown) => !value || (Array.isArray(value) && value.length === 0)
        const needsUpdate = isEmpty(outfit.pieces) || isEmpty(outfit.colors) || !outfit.top

        if (needsUpdate) {
          const pieces = Array.isArray(nextAnalysis.pieces) ? nextAnalysis.pieces.filter(Boolean) : []
          const colors = Array.isArray(nextAnalysis.color_names) ? nextAnalysis.color_names : []
          const occasions = Array.isArray(nextAnalysis.occasions) ? nextAnalysis.occasions.join(', ') : (nextAnalysis.occasion || '')

          const { error } = await supabase.from('outfits').update({
            top: nextAnalysis.outfit_name || outfit.top,
            pieces: pieces.length ? pieces : outfit.pieces,
            colors: colors.length ? colors : outfit.colors,
            occasion: occasions || outfit.occasion,
          }).eq('id', outfit.id)

          if (!error) {
            setOutfit((previous) => previous ? ({
              ...previous,
              top: nextAnalysis.outfit_name || previous.top,
              pieces: pieces.length ? pieces : previous.pieces,
              colors: colors.length ? colors : previous.colors,
              occasion: occasions || previous.occasion,
            }) : previous)
            setDataSaved(true)
          }
        }
      }
    } catch {
      setAnalysisError(isAr ? 'تعذّر تحليل الصورة. حاول مرة أخرى.' : 'Could not analyse image. Try again.')
    } finally {
      setAnalysing(false)
    }
  }

  const handleSave = async () => {
    if (!user || !outfit) return

    setIsSaving(true)
    try {
      if (saved) {
        await supabase
          .from('saved_outfits')
          .delete()
          .eq('user_id', user.id)
          .or(`outfit_ref.eq.${outfitId},outfit_id.eq.${outfitId}`)
        setSaved(false)
      } else {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(outfitId)
        const savedSource = source === 'db' ? 'manual' : source
        const { error } = await supabase.from('saved_outfits').insert([{
          user_id: user.id,
          outfit_ref: String(outfitId),
          source: savedSource,
          ...(isUuid ? { outfit_id: outfitId } : {}),
        }])
        if (!error) setSaved(true)
      }
    } finally {
      setIsSaving(false)
    }
  }



  if (loading) return <LoadingScreen />

  if (fetchError || !outfit) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4 px-6" dir={isAr ? 'rtl' : 'ltr'}>
        <ParticleCanvas />
        <p className={`relative z-10 text-zinc-600 text-[10px] text-center ${isAr ? '' : 'uppercase tracking-widest'}`}>{t.notFound}</p>
        <button onClick={handleBack} className={`relative z-10 text-zinc-500 text-[10px] hover:text-white transition mt-4 ${isAr ? '' : 'uppercase tracking-widest'}`} aria-label={t.goBack}>
          {isAr ? `${t.goBack} →` : `← ${t.goBack}`}
        </button>
      </div>
    )
  }

  const isExcel = source === 'excel'
  const rawTitle = deriveTitle(outfit, source)
  const title = tr(rawTitle)
  const rawStyleLabel = isExcel ? outfit.style_category : outfit.style
  const styleLabel = tr(rawStyleLabel)
  const rawColorScheme = isExcel ? outfit.color_scheme ?? null : null
  const rawWhenTo = isExcel ? outfit.when_to_wear : null
  const whenTo = tr(rawWhenTo) || null
  const outfitCode = outfit.outfit_code || null
  const outfitAesthetic = getAesthetic(rawColorScheme || null, outfit.aesthetic || null)
  const rawBrand = outfit.brand || null
  // Don't treat a JSON brands object as a plain brand name
  const brand = rawBrand && !rawBrand.startsWith('{') ? rawBrand : null
  const rawOccasions = isExcel ? outfit.occasions : outfit.occasion
  const occasionList = rawOccasions
    ? rawOccasions.split(/[|;,]/).map((value) => value.trim()).filter(Boolean)
    : []

  let hexColors: string[] = []
  let colorNames: string[] = []
  if (outfit.hex_colors) {
    try {
      hexColors = Array.isArray(outfit.hex_colors) ? outfit.hex_colors : JSON.parse(outfit.hex_colors)
    } catch {
      hexColors = []
    }
  }
  if (!isExcel && Array.isArray(outfit.colors) && outfit.colors.length) {
    colorNames = outfit.colors
    if (hexColors.length === 0) hexColors = outfit.colors.map(colorToHex)
  }

  const worksFor = deriveWorksFor(outfit, rawColorScheme, hexColors)
  // Parse per-piece brands from JSON stored in outfit.brand (e.g. {"top":"Uniqlo","bottom":"Zara"})
  let perPieceBrands: Record<string, string | null> | null = null
  if (outfit.brand?.startsWith('{')) {
    try { perPieceBrands = JSON.parse(outfit.brand) as Record<string, string | null> } catch {}
  }

  const PIECE_KEY_MAP: Record<string, string> = {
    Top: 'top', Bottom: 'bottom', Shoes: 'shoes',
    Accessories: 'accessories', Outerwear: 'outerwear', Shoe: 'shoes',
  }

  const pieces: Array<{ label: string; value: string; pieceKey?: string }> = []
  if (isExcel) {
    if (outfit.top_wear) pieces.push({ label: 'Top', value: outfit.top_wear, pieceKey: 'top' })
    if (outfit.bottom_wear) pieces.push({ label: 'Bottom', value: outfit.bottom_wear, pieceKey: 'bottom' })
    if (outfit.shoes) pieces.push({ label: 'Shoes', value: outfit.shoes, pieceKey: 'shoes' })
    if (outfit.accessories) pieces.push({ label: 'Accessories', value: outfit.accessories, pieceKey: 'accessories' })
    if (outfit.outerwear) pieces.push({ label: 'Outerwear', value: outfit.outerwear, pieceKey: 'outerwear' })
  } else if (Array.isArray(outfit.pieces) && outfit.pieces.length) {
    outfit.pieces.forEach((piece, index) => {
      const labels = ['Top', 'Bottom', 'Shoes', 'Accessories', 'Outerwear', 'Extra']
      const label = labels[index] || `Piece ${index + 1}`
      pieces.push({ label, value: piece, pieceKey: PIECE_KEY_MAP[label] })
    })
  } else if (outfit.top) {
    pieces.push({ label: 'Top', value: outfit.top, pieceKey: 'top' })
  }

  const materials: Array<{ label: string; value: string }> = []
  if (isExcel) {
    if (outfit.material_top) materials.push({ label: 'Top', value: outfit.material_top })
    if (outfit.material_bottom) materials.push({ label: 'Bottom', value: outfit.material_bottom })
    if (outfit.material_shoes) materials.push({ label: 'Shoe', value: outfit.material_shoes })
    if (outfit.material_notes) materials.push({ label: '', value: outfit.material_notes })
  }

  const fadeUp = (delay: number): React.CSSProperties => ({
    animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both',
    animationDelay: `${delay}s`,
  })


  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-x-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <ParticleCanvas />

      <nav className="fixed top-0 w-full z-50 px-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))', paddingBottom: '1rem', animation: 'fadeDown 0.5s cubic-bezier(0.4,0,0.2,1) both' }}>
        <button
          onClick={handleBack}
          className="cursor-pointer text-zinc-500 hover:text-white transition-colors duration-200 min-h-[44px] min-w-[44px] flex items-center gap-1.5 active:scale-90"
          aria-label={t.goBack}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ transform: isAr ? 'scaleX(-1)' : 'none' }}><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span
          className={`text-[9px] text-zinc-700 ${isAr ? '' : 'tracking-[0.4em] uppercase'}`}
          style={{ fontFamily: isAr ? 'var(--font-arabic, serif)' : 'inherit' }}
        >
          {t.archive}
        </span>
        <div className="w-[44px]" />
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-4 sm:px-5" style={{ paddingTop: 'calc(max(1.25rem, env(safe-area-inset-top)) + 52px)', paddingBottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 88px)' }}>
        <div className="w-full rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-900 mb-7 shadow-[0_32px_80px_rgba(0,0,0,0.7)] relative" style={{ aspectRatio: '3/4', animation: 'scaleUp 0.65s cubic-bezier(0.4,0,0.2,1) both' }}>
          {outfit.image_url ? (
            <OutfitHeroImage outfit={outfit} title={title} />
          ) : generatingImage ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
              <span className={`text-zinc-700 text-[9px] ${isAr ? '' : 'uppercase tracking-widest'}`}>{t.generating}</span>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className={`text-zinc-800 text-[9px] ${isAr ? '' : 'uppercase tracking-widest'}`}>{t.noImage}</span>
            </div>
          )}
        </div>

        <div className="mb-7" style={fadeUp(0.1)}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {styleLabel ? <span className={`text-[9px] text-zinc-600 border border-zinc-800 rounded-full px-3 py-1 ${isAr ? '' : 'uppercase tracking-[0.3em]'}`}>{styleLabel}</span> : null}
            {outfitCode ? <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-800 font-mono">{outfitCode}</span> : null}
          </div>
          {rawTitle.toLowerCase() !== (rawStyleLabel || '').toLowerCase() ? (
            <h1 className="text-[26px] font-light tracking-tight leading-snug text-white">{title}</h1>
          ) : null}
          {outfitAesthetic ? (
            <div className="flex items-center gap-2 mt-2">
              {outfitAesthetic.swatches.map((hex) => (
                <div key={hex} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: hex }} />
              ))}
              <span className={`text-[9px] text-zinc-600 ml-1 ${isAr ? '' : 'uppercase tracking-[0.25em]'}`}>{tr(outfitAesthetic.label)}</span>
            </div>
          ) : null}
        </div>

        {hexColors.length > 0 ? (
          <div className="mb-8" style={fadeUp(0.15)}>
            <SectionLabel isAr={isAr}>{t.colourPalette}</SectionLabel>
            <div className="flex gap-3 flex-wrap">
              {hexColors.map((hex, index) => (
                <div key={`${hex}-${index}`} className="flex flex-col items-center gap-2">
                  <div className="w-11 h-11 rounded-full border-2 border-white/8 shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:scale-110 transition-transform duration-200 cursor-default" style={{ backgroundColor: hex, boxShadow: `0 4px 16px ${hex}30` }} title={colorNames[index] || hex} />
                  {colorNames[index] ? <span className={`text-[8px] text-zinc-600 text-center max-w-[44px] truncate ${isAr ? '' : 'uppercase tracking-wider'}`}>{tr(colorNames[index])}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {occasionList.length > 0 ? (
          <div className="mb-8" style={fadeUp(0.2)}>
            <SectionLabel isAr={isAr}>{t.occasions}</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {occasionList.map((occasion) => (
                <span key={occasion} className={`px-4 py-2 border border-zinc-800 rounded-full text-[10px] text-zinc-400 bg-zinc-950/50 ${isAr ? '' : 'uppercase tracking-wider'}`}>
                  {tr(occasion)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {whenTo ? (
          <div className="mb-8" style={fadeUp(0.25)}>
            <SectionLabel isAr={isAr}>{t.whenToWear}</SectionLabel>
            <p className="text-sm text-zinc-400 leading-relaxed">{whenTo}</p>
          </div>
        ) : null}

        {worksFor.length > 0 ? (
          <div className="mb-8" style={fadeUp(0.27)}>
            <SectionLabel isAr={isAr}>{t.worksFor}</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {worksFor.map((tone) => (
                <span key={tone} className={`px-4 py-2 border border-zinc-800 rounded-full text-[10px] text-zinc-500 bg-zinc-950/50 ${isAr ? '' : 'uppercase tracking-wider'}`}>
                  {localTone(tone, isAr)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {pieces.length > 0 ? (
          <div className="mb-8" style={fadeUp(0.3)}>
            <SectionLabel isAr={isAr}>{t.pieces}</SectionLabel>
            <div className="divide-y divide-zinc-900/80">
              {pieces.map((piece) => {
                const specificBrand = piece.pieceKey ? (perPieceBrands?.[piece.pieceKey] ?? null) : null
                const brandInfo = detectPieceBrand(piece.value, brand, specificBrand)
                const outfitGender: Gender = outfit.gender === 'female' ? 'female' : 'male'
                const fallback = getCategoryBrandLink(piece.value, outfitGender)
                return (
                  <div
                    key={`${piece.label}-${piece.value}`}
                    className={`flex items-start gap-3 py-3.5 ${isAr ? 'flex-row-reverse' : ''}`}
                  >
                    <span className={`text-[9px] text-zinc-700 w-20 shrink-0 pt-0.5 ${isAr ? 'text-left' : 'uppercase tracking-[0.25em]'}`}>{localLabel(piece.label, isAr)}</span>
                    <span className={`text-[13px] text-zinc-300 leading-snug flex-1 ${isAr ? 'text-right' : ''}`}>{tr(piece.value)}</span>
                    {brandInfo ? (
                      <div className="flex flex-col gap-1.5 shrink-0" dir="ltr">
                        <a
                          href={brandInfo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 border border-zinc-800 rounded-full text-[9px] uppercase tracking-widest text-zinc-500 hover:border-zinc-500 hover:text-white transition-all duration-200 active:scale-95 whitespace-nowrap"
                        >
                          {brandInfo.brand}
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M7 7h10v10"/></svg>
                        </a>
                        <NearbyStoreButton brand={brandInfo.brand} isAr={isAr} />
                      </div>
                    ) : (
                      <a
                        href={fallback.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 shrink-0 px-2.5 py-1 border border-zinc-800 rounded-full text-[9px] uppercase tracking-widest text-zinc-500 hover:border-zinc-500 hover:text-white transition-all duration-200 active:scale-95 whitespace-nowrap"
                        dir="ltr"
                      >
                        {fallback.label}
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M7 7h10v10"/></svg>
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {materials.length > 0 ? (
          <div className="mb-8" style={fadeUp(0.38)}>
            <SectionLabel isAr={isAr}>{t.materials}</SectionLabel>
            <div className="divide-y divide-zinc-900/80">
              {materials.map((material) => (
                <div key={`${material.label}-${material.value}`} className="py-3.5">
                  <p className={`text-[9px] text-zinc-700 mb-1.5 ${isAr ? '' : 'uppercase tracking-[0.25em]'}`}>
                    {material.label ? (isAr ? `${t.material} ${localLabel(material.label, isAr)}` : `${material.label} ${t.material}`) : t.notes}
                  </p>
                  <p className="text-[13px] text-zinc-400 leading-relaxed">{tr(material.value)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(() => {
          const rawDetails = outfit.outfit_details || ''
          const proTipMatch = rawDetails.match(/^([\s\S]*?)\s*pro\s+tip[:\s]+/i)
          const detailsText = proTipMatch ? (proTipMatch[1] ?? '').trim() : rawDetails.trim()
          const inlineTip = proTipMatch
            ? rawDetails.slice(proTipMatch[0].length).trim()
            : null
          const proTipText = outfit.pro_tip || inlineTip

          if (!detailsText && !proTipText) return null
          return (
            <div className="mb-8 space-y-5" style={fadeUp(0.5)}>
              <div className="h-px bg-zinc-900" />
              {detailsText ? (
                <div className="pl-3 border-l-2 border-zinc-800">
                  <p className={`text-[9px] text-zinc-700 mb-1.5 ${isAr ? '' : 'uppercase tracking-[0.2em]'}`}>{t.detailsNotes}</p>
                  <p className="text-[13px] text-zinc-400 leading-relaxed">{tr(detailsText)}</p>
                </div>
              ) : null}
              {proTipText ? (
                <div className="pl-3 border-l-2 border-zinc-800">
                  <p className={`text-[9px] text-zinc-700 mb-1.5 ${isAr ? '' : 'uppercase tracking-[0.2em]'}`}>{t.proTip}</p>
                  <p className="text-[13px] text-zinc-400 leading-relaxed">{tr(proTipText)}</p>
                </div>
              ) : null}
            </div>
          )
        })()}

        {(() => {
          const allBrands = perPieceBrands
            ? Object.values(perPieceBrands).filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
            : brand ? [brand] : []
          const uniqueBrands = [...new Set(allBrands)]
          return <NearbyShopsSection brands={uniqueBrands} isAr={isAr} />
        })()}

        {(() => {
          const outfitGenderForTrack: Gender = outfit.gender === 'female' ? 'female' : 'male'
          const trackable = pieces.map(piece => {
            const specificBrand = piece.pieceKey ? (perPieceBrands?.[piece.pieceKey] ?? null) : null
            const brandInfo = detectPieceBrand(piece.value, brand, specificBrand)
            const firstOption = piece.value.split(/\s+or\s+/i)[0] ?? piece.value
            const categoryLink = getCategoryBrandLink(piece.value, outfitGenderForTrack)
            return {
              name: firstOption.trim().slice(0, 80),
              url: brandInfo?.url ?? categoryLink.url,
              brand: brandInfo?.brand ?? categoryLink.label,
            }
          })
          return <OutfitPriceTracker trackablePieces={trackable} userId={user?.id} isAr={isAr} />
        })()}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 px-5 pt-8 bg-gradient-to-t from-black via-black/95 to-transparent" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className={`max-w-lg mx-auto flex items-center gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`cursor-pointer flex-1 flex items-center justify-center gap-2.5 py-4 text-[10px] font-bold transition-all duration-300 rounded-2xl active:scale-[0.97] ${isAr ? '' : 'uppercase tracking-[0.4em]'} ${
              saved
                ? 'bg-transparent border border-zinc-800 text-zinc-500 hover:border-red-900/50 hover:text-red-400'
                : 'bg-white text-black hover:bg-zinc-100'
            }`}
            aria-label={saved ? t.removeFromCloset : t.saveToCloset}
          >
            {isSaving ? (
              <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : saved ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
            {isSaving ? t.processing : saved ? t.savedToCloset : t.saveToCloset}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeDown { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes scaleUp { from { opacity:0; transform:scale(0.96) translateY(14px) } to { opacity:1; transform:scale(1) translateY(0) } }
      `}</style>
    </div>
  )
}
