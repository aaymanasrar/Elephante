'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LoadingScreen from '@/app/components/LoadingScreen'
import ParticleCanvas from '@/components/ParticleCanvas'
import { detectPieceBrand, getAesthetic } from '@/lib/brands'
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
    wornTimes: (n: number) => n === 1 ? 'Worn 1 time' : `Worn ${n} times`,
    lastWorn: 'Last worn',
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
    wornTimes: (n: number) => `ارتديت ${n} مرة`,
    lastWorn: 'آخر ارتداء',
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
  why_it_works?: string
  styling_tip?: string
  key_colors?: string[]
  pieces?: string[]
  color_names?: string[]
  occasions?: string[]
  occasion?: string
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
  const closetBackHref = closetSection === 'personal' || closetSection === 'stylist' || closetSection === 'curated'
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

      const nextAnalysis = data.analysis as AnalysisState
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
  const brand = outfit.brand || null
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
  const pieces: Array<{ label: string; value: string }> = []
  if (isExcel) {
    if (outfit.top_wear) pieces.push({ label: 'Top', value: outfit.top_wear })
    if (outfit.bottom_wear) pieces.push({ label: 'Bottom', value: outfit.bottom_wear })
    if (outfit.shoes) pieces.push({ label: 'Shoes', value: outfit.shoes })
    if (outfit.accessories) pieces.push({ label: 'Accessories', value: outfit.accessories })
    if (outfit.outerwear) pieces.push({ label: 'Outerwear', value: outfit.outerwear })
  } else if (Array.isArray(outfit.pieces) && outfit.pieces.length) {
    outfit.pieces.forEach((piece, index) => {
      const labels = ['Top', 'Bottom', 'Shoes', 'Accessories', 'Outerwear', 'Extra']
      pieces.push({ label: labels[index] || `Piece ${index + 1}`, value: piece })
    })
  } else if (outfit.top) {
    pieces.push({ label: 'Top', value: outfit.top })
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
                const brandInfo = detectPieceBrand(piece.value, brand)
                return (
                  <div
                    key={`${piece.label}-${piece.value}`}
                    className={`flex items-center gap-3 py-3.5 ${isAr ? 'flex-row-reverse' : ''}`}
                  >
                    <span className={`text-[9px] text-zinc-700 w-20 shrink-0 ${isAr ? 'text-left' : 'uppercase tracking-[0.25em]'}`}>{localLabel(piece.label, isAr)}</span>
                    <span className={`text-[13px] text-zinc-300 leading-snug flex-1 ${isAr ? 'text-right' : ''}`}>{tr(piece.value)}</span>
                    {brandInfo ? (
                      <a
                        href={brandInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-3 py-1 border border-zinc-800 rounded-full text-[9px] uppercase tracking-widest text-zinc-500 hover:border-zinc-500 hover:text-white transition-all duration-200 active:scale-95 whitespace-nowrap"
                        dir="ltr"
                      >
                        {brandInfo.brand}
                      </a>
                    ) : null}
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

        {outfit.image_url ? (
          <div className="mb-2" style={fadeUp(0.5)}>
            <div className="h-px bg-zinc-900 mb-6" />
            <button
              onClick={handleAnalyse}
              disabled={analysing}
              className={`cursor-pointer w-full h-12 rounded-2xl border border-zinc-800 text-zinc-500 text-[10px] font-bold hover:border-zinc-600 hover:text-white transition-all duration-300 active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2.5 ${isAr ? '' : 'uppercase tracking-[0.3em]'}`}
            >
              {analysing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
                  {t.analysing}
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                  </svg>
                  {dataSaved ? t.reanalyse : analysis ? t.reanalyse : t.analyse}
                  {dataSaved ? <span className={`text-[9px] text-emerald-500/80 ${isAr ? '' : 'uppercase tracking-widest'}`}>· {t.saved}</span> : null}
                </>
              )}
            </button>
            {analysisError ? <p className="text-red-400 text-[11px] text-center mt-3">{analysisError}</p> : null}

            {analysis ? (
              <div className="mt-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-400">
                {analysis.key_colors?.length ? (
                  <div className="flex gap-2.5">
                    {analysis.key_colors.map((hex) => (
                      <div key={hex} className="w-9 h-9 rounded-xl border border-white/10 shadow-sm" style={{ backgroundColor: hex }} />
                    ))}
                  </div>
                ) : null}
                <div>
                  <p className="text-white text-base font-light">{tr(analysis.outfit_name)}</p>
                  <p className="text-zinc-500 text-[11px] mt-0.5 tracking-wide">{tr(analysis.vibe)} · {tr(analysis.style)}</p>
                </div>
                {analysis.color_scheme ? <p className="text-zinc-600 text-[12px] italic">{tr(analysis.color_scheme)}</p> : null}
                {analysis.why_it_works ? (
                  <div className="pl-3 border-l-2 border-zinc-800">
                    <p className={`text-[9px] text-zinc-700 mb-1.5 ${isAr ? '' : 'uppercase tracking-[0.2em]'}`}>{t.detailsNotes}</p>
                    <p className="text-[13px] text-zinc-400 leading-relaxed">{tr(analysis.why_it_works)}</p>
                  </div>
                ) : null}
                {analysis.styling_tip ? (
                  <div className="pl-3 border-l-2 border-zinc-800">
                    <p className={`text-[9px] text-zinc-700 mb-1.5 ${isAr ? '' : 'uppercase tracking-[0.2em]'}`}>{t.proTip}</p>
                    <p className="text-[13px] text-zinc-400 leading-relaxed">{tr(analysis.styling_tip)}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
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
