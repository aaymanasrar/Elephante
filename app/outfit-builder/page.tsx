'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRequireUser } from '@/hooks/useRequireUser'
import ParticleCanvas from '@/components/ParticleCanvas'
import { useLocale } from '@/lib/locale-context'

type InputMode = 'prompt' | 'url' | 'photo' | null

interface ZoneItem {
  label: string
  preview: string | null  // image data-url or url
  file: File | null
  prompt: string
  inputMode: InputMode
  inputDraft: string
}

interface OutfitAnalysis {
  match_score: number
  proportion_score: number
  color_harmony_score: number
  silhouette_feedback: string
  skin_tone_feedback?: string
  overall_verdict?: string
  why_it_works?: string
  styling_tip?: string
}

type ZoneKey = 'top' | 'outerwear' | 'bottom' | 'shoes' | 'accessories'

const ZONES: { key: ZoneKey; label: string; emoji: string; hint: string }[] = [
  { key: 'top',         label: 'Top',         emoji: '👕', hint: 'Shirt, tee, blouse…' },
  { key: 'outerwear',   label: 'Outerwear',   emoji: '🧥', hint: 'Jacket, coat, blazer…' },
  { key: 'bottom',      label: 'Bottom',      emoji: '👖', hint: 'Pants, skirt, shorts…' },
  { key: 'shoes',       label: 'Shoes',       emoji: '👟', hint: 'Sneakers, boots, heels…' },
  { key: 'accessories', label: 'Accessories', emoji: '💍', hint: 'Watch, bag, hat…' },
]

const ZONE_AR: Record<ZoneKey, { label: string; hint: string }> = {
  top: { label: 'علوي', hint: 'قميص، تيشيرت، بلوزة...' },
  outerwear: { label: 'طبقة خارجية', hint: 'جاكيت، معطف، بليزر...' },
  bottom: { label: 'سفلي', hint: 'بنطال، تنورة، شورت...' },
  shoes: { label: 'أحذية', hint: 'سنيكرز، بوت، كعب...' },
  accessories: { label: 'إكسسوارات', hint: 'ساعة، حقيبة، قبعة...' },
}

const builderCopy = {
  en: {
    back: 'Back',
    title: 'Outfit Builder',
    save: 'Save',
    clear: 'Clear',
    uploadPhoto: 'Upload photo',
    pasteUrl: 'Paste URL',
    describe: 'Describe it',
    pasteProductUrl: 'Paste any product URL...',
    describeYour: (label: string) => `Describe your ${label.toLowerCase()}...`,
    add: 'Add',
    tapZone: 'Tap a zone to style it',
    consulting: 'Consulting AI Stylist...',
    rate: 'Rate This Outfit!',
    verdict: 'AI Stylist Verdict',
    match: 'Match',
    strong: 'Absolutely amazing. These pieces were made for each other.',
    weak: 'Hmm. You might want to rethink this combination.',
    uploadPhotoToRate: 'Attach at least one outfit photo to rate it.',
    uploadError: 'Attach at least one outfit photo to test the look.',
    failed: 'Failed to test outfit match.',
    overall: 'Overall Outfit',
    skinTone: 'Skin Tone Match',
    whyWorks: 'Why it Works',
    tip: 'Pro Tip',
    proportion: 'Proportion',
    harmony: 'Color Harmony',
    silhouette: 'Silhouette & Fit',
  },
  ar: {
    back: 'رجوع',
    title: 'منسق الإطلالة',
    save: 'حفظ',
    clear: 'مسح',
    uploadPhoto: 'رفع صورة',
    pasteUrl: 'إضافة رابط',
    describe: 'وصف القطعة',
    pasteProductUrl: 'الصق رابط المنتج...',
    describeYour: (label: string) => `صف قطعة ${label}...`,
    add: 'إضافة',
    tapZone: 'اضغط على جزء لتنسيقه',
    consulting: 'جارٍ استشارة AI Stylist...',
    rate: 'قيّم هذه الإطلالة',
    verdict: 'رأي منسق الذكاء الاصطناعي',
    match: 'توافق',
    strong: 'ممتازة جداً. القطع كأنها صنعت لبعضها.',
    weak: 'قد تحتاج إلى إعادة التفكير في هذا التنسيق.',
    uploadPhotoToRate: 'ارفع صورة واحدة على الأقل للإطلالة لتقييمها.',
    uploadError: 'ارفع صورة واحدة على الأقل لاختبار الإطلالة.',
    failed: 'تعذّر اختبار توافق الإطلالة.',
    overall: 'الإطلالة بالكامل',
    skinTone: 'تناسق مع البشرة',
    whyWorks: 'لماذا تناسبك',
    tip: 'نصيحة للمظهر',
    proportion: 'التناسق',
    harmony: 'تناغم الألوان',
    silhouette: 'الشكل والمقاس',
  },
} as const

const EMPTY_ZONE = (): ZoneItem => ({
  label: '',
  preview: null,
  file: null,
  prompt: '',
  inputMode: null,
  inputDraft: '',
})

const MAX_ANALYSIS_IMAGE_EDGE = 1400

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(String(event.target?.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Could not read image.'))
    reader.readAsDataURL(file)
  })
}

async function createAnalysisImageDataUrl(file: File) {
  const fallback = () => readFileAsDataUrl(file)
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Could not load image.'))
      nextImage.src = objectUrl
    })

    const maxEdge = Math.max(image.naturalWidth, image.naturalHeight)
    if (!maxEdge) return fallback()

    const scale = Math.min(1, MAX_ANALYSIS_IMAGE_EDGE / maxEdge)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return fallback()

    context.fillStyle = '#f7f4ef'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.86)
  } catch {
    return fallback()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function getAttachedImageEntries(zones: Record<ZoneKey, ZoneItem>) {
  return ZONES
    .map((zone) => {
      const item = zones[zone.key]
      if (!item.preview) return null
      return {
        label: zone.label,
        imageUrl: item.preview,
      }
    })
    .filter((entry): entry is { label: string; imageUrl: string } => Boolean(entry))
}

function buildOutfitDetails(zones: Record<ZoneKey, ZoneItem>) {
  return ZONES
    .map((zone) => {
      const item = zones[zone.key]
      const detail = item.prompt || item.label
      return detail ? `${zone.label}: ${detail}` : null
    })
    .filter((detail): detail is string => Boolean(detail))
    .join('\n')
}

function normalizeScore(value: unknown) {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}



function ZoneInput({
  zone,
  item,
  onChange,
  onPhotoSelect,
  onConfirm,
  onClear,
  isAr,
  copy,
}: {
  zone: { key: ZoneKey; label: string; hint: string; emoji: string }
  item: ZoneItem
  onChange: (patch: Partial<ZoneItem>) => void
  onPhotoSelect: () => void
  onConfirm: () => void
  onClear: () => void
  isAr: boolean
  copy: typeof builderCopy.en | typeof builderCopy.ar
}) {
  const hasContent = item.preview || item.prompt
  const label = isAr ? ZONE_AR[zone.key].label : zone.label
  const hint = isAr ? ZONE_AR[zone.key].hint : zone.hint

  return (
    <div className={`rounded-2xl border transition-all duration-200 ${hasContent ? 'border-zinc-600 bg-zinc-900/80' : 'border-zinc-800 bg-zinc-900/40'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base">{zone.emoji}</span>
          <div>
            <p className={`text-[11px] font-semibold text-white ${isAr ? '' : 'uppercase tracking-widest'}`}>{label}</p>
            {!hasContent && <p className="text-[10px] text-zinc-600">{hint}</p>}
            {item.prompt && !item.preview && <p className="text-[10px] text-zinc-400 truncate max-w-[160px]">{item.prompt}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasContent ? (
            <button
              onClick={onClear}
              className="text-zinc-600 hover:text-red-400 transition-colors p-1"
              aria-label={copy.clear}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <div className="flex gap-1">
              {/* Photo */}
              <button
                onClick={onPhotoSelect}
                className={`p-2 rounded-xl transition-all ${item.inputMode === 'photo' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-white'}`}
                title={copy.uploadPhoto}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              {/* URL */}
              <button
                onClick={() => onChange({ inputMode: item.inputMode === 'url' ? null : 'url', inputDraft: '' })}
                className={`p-2 rounded-xl transition-all ${item.inputMode === 'url' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-white'}`}
                title={copy.pasteUrl}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </button>
              {/* Prompt */}
              <button
                onClick={() => onChange({ inputMode: item.inputMode === 'prompt' ? null : 'prompt', inputDraft: '' })}
                className={`p-2 rounded-xl transition-all ${item.inputMode === 'prompt' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-white'}`}
                title={copy.describe}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            </div>
          )}

          {/* Preview thumbnail */}
          {item.preview && (
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 ml-1 flex-shrink-0 relative">
              <img src={item.preview} alt={label} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Expanded input */}
      {(item.inputMode === 'url' || item.inputMode === 'prompt') && !hasContent && (
        <div className="px-4 pb-3 flex gap-2">
          <input
            type={item.inputMode === 'url' ? 'url' : 'text'}
            placeholder={item.inputMode === 'url' ? copy.pasteProductUrl : copy.describeYour(label)}
            value={item.inputDraft}
            onChange={(e) => onChange({ inputDraft: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && item.inputDraft.trim() && onConfirm()}
            autoFocus
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            onClick={onConfirm}
            disabled={!item.inputDraft.trim()}
            className="px-3 py-2 bg-white text-black rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 transition-opacity active:scale-95"
          >
            {copy.add}
          </button>
        </div>
      )}
    </div>
  )
}

function OutfitBuilderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectParam = searchParams?.get('preselect')
  const preselectIds = preselectParam
    ? preselectParam.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
    : []
  const { isAr } = useLocale()
  const copy = isAr ? builderCopy.ar : builderCopy.en
  const { user } = useRequireUser('/login')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const fileTargetZoneRef = useRef<ZoneKey | null>(null)
  const [activeZone, setActiveZone] = useState<ZoneKey | null>(null)
  const [analysis, setAnalysis] = useState<OutfitAnalysis | null>(null)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string | React.ReactNode }[]>([])
  const [matchError, setMatchError] = useState<string | null>(null)
  const [userSkinTone, setUserSkinTone] = useState('')
  const [userProfile, setUserProfile] = useState<{
    gender?: string
    skin_undertone?: string
    body_shape?: string
    height_category?: string
  }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [mixLoading, setMixLoading] = useState(false)
  const [compatScore, setCompatScore] = useState<{ score: number; verdict: string; suggestion: string | null } | null>(null)
  const [compatLoading, setCompatLoading] = useState(false)
  const [tryOnResult, setTryOnResult] = useState<string | null>(null)
  const [tryOnLoading, setTryOnLoading] = useState(false)
  const [zones, setZones] = useState<Record<ZoneKey, ZoneItem>>({
    top:         EMPTY_ZONE(),
    outerwear:   EMPTY_ZONE(),
    bottom:      EMPTY_ZONE(),
    shoes:       EMPTY_ZONE(),
    accessories: EMPTY_ZONE(),
  })

  useEffect(() => {
    if (!user || preselectIds.length === 0) return

    const loadPreselectedItems = async () => {
      try {
        const { data, error } = await supabase
          .from('closet_items')
          .select('*')
          .in('id', preselectIds)

        if (error || !data) return

        const updates: Partial<Record<ZoneKey, ZoneItem>> = {}
        for (const item of data) {
          let zoneKey: ZoneKey | null = null
          if (item.category === 'tops') zoneKey = 'top'
          else if (item.category === 'bottoms') zoneKey = 'bottom'
          else if (item.category === 'shoes') zoneKey = 'shoes'
          else if (item.category === 'outerwear') zoneKey = 'outerwear'
          else if (item.category === 'accessories') zoneKey = 'accessories'

          if (zoneKey && !updates[zoneKey]) {
            updates[zoneKey] = {
              label: item.item_name || 'Selected Piece',
              preview: item.image_url || null,
              file: null,
              prompt: `From My Closet: ${item.item_name || ''}`,
              inputMode: null,
              inputDraft: '',
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          setZones((prev) => ({ ...prev, ...updates }))
        }
      } catch (err) {
        console.error('Failed to preselect items:', err)
      }
    }

    loadPreselectedItems()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, preselectParam])

  useEffect(() => {
    if (!user) return

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('skin_tone, gender, skin_undertone, body_shape, height_category')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Failed to load profile:', error)
        return
      }

      setUserSkinTone(data?.skin_tone || '')
      setUserProfile({
        gender: data?.gender,
        skin_undertone: data?.skin_undertone,
        body_shape: data?.body_shape,
        height_category: data?.height_category,
      })
    }

    loadProfile()
  }, [user])

  const patch = (key: ZoneKey, update: Partial<ZoneItem>) => {
    setZones((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }))
  }

  const handlePhotoSelect = (key: ZoneKey) => {
    fileTargetZoneRef.current = key
    setActiveZone(key)
    patch(key, { inputMode: 'photo', inputDraft: '' })
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetZone = fileTargetZoneRef.current || activeZone
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!targetZone || !file) {
      fileTargetZoneRef.current = null
      return
    }

    try {
      const preview = await createAnalysisImageDataUrl(file)
      patch(targetZone, {
        preview,
        file,
        inputMode: null,
        inputDraft: '',
        label: file.name.replace(/\.[^/.]+$/, ''),
      })
      setAnalysis(null)
      setMatchError(null)
    } catch (error) {
      console.error('Failed to prepare outfit photo:', error)
      setMatchError(copy.failed)
    } finally {
      fileTargetZoneRef.current = null
    }
  }

  const handleConfirm = (key: ZoneKey) => {
    const item = zones[key]
    if (!item.inputDraft.trim()) return
    if (item.inputMode === 'url') {
      patch(key, { preview: item.inputDraft.trim(), file: null, label: item.inputDraft.trim(), inputMode: null, inputDraft: '' })
    } else {
      patch(key, { prompt: item.inputDraft.trim(), file: null, label: item.inputDraft.trim(), inputMode: null, inputDraft: '' })
    }
    setAnalysis(null)
    setMatchError(null)
  }

  const handleClear = (key: ZoneKey) => {
    patch(key, EMPTY_ZONE())
    setAnalysis(null)
    setMatchError(null)
  }

  const checkOutfitMatch = async (
    imageEntries: Array<{ label: string; imageUrl: string }>,
    userSkinTone: string,
    profile: typeof userProfile,
    outfitDetails: string,
  ) => {
    try {
      const response = await fetch('/api/analyze-outfit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageEntries[0]?.imageUrl,
          image_urls: imageEntries.map((entry) => entry.imageUrl),
          image_labels: imageEntries.map((entry) => entry.label),
          outfit_details: outfitDetails,
          language: isAr ? 'ar' : 'en',
          skin_tone: userSkinTone || 'medium_neutral',
          gender: profile.gender,
          skin_undertone: profile.skin_undertone,
          body_shape: profile.body_shape,
          height_category: profile.height_category,
        }),
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)
      return data.analysis as OutfitAnalysis
    } catch (error) {
      console.error('Failed to analyze outfit:', error)
      throw error
    }
  }

  const handleMixAndMatch = async () => {
    if (!user) {
      setMatchError(isAr ? 'يجب تسجيل الدخول أولاً.' : 'You must sign in first.')
      return
    }

    setMixLoading(true)
    setMatchError(null)

    try {
      const { data: closetItems, error: closetError } = await supabase
        .from('closet_items')
        .select('*')
        .eq('user_id', user.id)

      if (closetError) throw new Error(closetError.message)
      if (!closetItems || closetItems.length === 0) {
        setMatchError(
          isAr
            ? 'خزانتك فارغة! يرجى رفع بعض الصور لملابسك في صفحة الخزانة أولاً.'
            : 'Your closet is empty! Please upload some clothing photos in your Closet tab first.'
        )
        return
      }

      const response = await fetch('/api/outfit-mix-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_pieces: zones,
          closet_items: closetItems,
          user_profile: {
            gender: userProfile.gender,
            skin_tone: userSkinTone,
            body_shape: userProfile.body_shape,
            style_preference: userProfile.gender
          },
          language: isAr ? 'ar' : 'en'
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      if (data.matches && data.matches.length > 0) {
        data.matches.forEach((match: any) => {
          const zoneKey = match.zone.toLowerCase() as ZoneKey
          if (ZONES.some(z => z.key === zoneKey)) {
            patch(zoneKey, {
              preview: match.image_url || null,
              prompt: match.reason || match.item_name,
              label: match.item_name,
              inputMode: null,
              inputDraft: '',
              file: null
            })
          }
        })

        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.ai_verdict || (isAr ? 'لقد قمت بتنسيق خزانتك بذكاء!' : 'Intelligently completed your outfit with items from your Closet!')
          }
        ])
      } else {
        setMatchError(
          isAr
            ? 'لم أجد قطعاً إضافية متناسقة في خزانتك حالياً.'
            : 'AI Stylist couldn\'t find additional highly matching items in your Closet.'
        )
      }
    } catch (err: any) {
      console.error('Mix Match Action Error:', err)
      setMatchError(err.message || copy.failed)
    } finally {
      setMixLoading(false)
    }
  }

  const handleTestOutfit = async () => {
    const imageEntries = getAttachedImageEntries(zones)

    if (imageEntries.length === 0) {
      setAnalysis(null)
      setMatchError(copy.uploadError)
      return
    }

    setIsLoading(true)
    setAnalysis(null)
    setMatchError(null)

    try {
      const result = await checkOutfitMatch(imageEntries, userSkinTone, userProfile, buildOutfitDetails(zones))
      setAnalysis(result)
      
      // Build chat sequence
      const newMessages: typeof messages = [
        { 
          role: 'user', 
          content: (
            <div className="flex gap-2 flex-wrap">
              {imageEntries.map((img, i) => (
                <img key={i} src={img.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
              ))}
            </div>
          )
        }
      ]
      setMessages(newMessages)

      // Add AI response after a short delay
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { 
            role: 'assistant', 
            content: result.overall_verdict || (isAr ? 'إليك تحليلي لإطلالتك...' : 'Here is my analysis of your look...')
          }
        ])
      }, 600)

    } catch (error) {
      setMatchError(error instanceof Error ? error.message : copy.failed)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompatibilityCheck = async () => {
    const imageEntries = getAttachedImageEntries(zones)
    if (imageEntries.length < 2) return
    setCompatLoading(true)
    setCompatScore(null)
    try {
      const res = await fetch('/api/outfit-compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_urls: imageEntries.map((e) => e.imageUrl),
          item_names: imageEntries.map((e) => e.label),
          occasion: 'casual',
          language: isAr ? 'ar' : 'en',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCompatScore({ score: data.score, verdict: data.verdict, suggestion: data.suggestion ?? null })
    } catch {
      // silent fail — main analysis covers this
    } finally {
      setCompatLoading(false)
    }
  }

  const handleTryOn = async () => {
    const imageEntries = getAttachedImageEntries(zones)
    const personEntry = imageEntries[0]
    const garmentEntry = imageEntries[1]
    if (!personEntry || !garmentEntry) return
    setTryOnLoading(true)
    setTryOnResult(null)
    try {
      const res = await fetch('/api/outfit-tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_url: personEntry.imageUrl,
          garment_url: garmentEntry.imageUrl,
          garment_description: garmentEntry.label,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTryOnResult(data.image_url)
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : isAr ? 'تعذّر تجربة الملابس.' : 'Try-on failed.')
    } finally {
      setTryOnLoading(false)
    }
  }

  const filledCount = Object.values(zones).filter((z) => z.preview || z.prompt).length
  const attachedImageCount = getAttachedImageEntries(zones).length
  const hasAnalyzablePhotos = attachedImageCount > 0
  const displayedMatchScore = analysis ? normalizeScore(analysis.match_score) : 0
  const displayedProportionScore = analysis ? normalizeScore(analysis.proportion_score) : 0
  const displayedHarmonyScore = analysis ? normalizeScore(analysis.color_harmony_score) : 0

  return (
    <div className="min-h-[100dvh] bg-black text-white relative" dir={isAr ? 'rtl' : 'ltr'}>
      <ParticleCanvas />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-8 pb-4">
        <button
          onClick={() => router.back()}
          className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors min-h-[44px] flex items-center"
        >
          {isAr ? `${copy.back} →` : `← ${copy.back}`}
        </button>
        <h1 className="text-[11px] font-bold tracking-[0.4em] text-zinc-500 uppercase">{copy.title}</h1>
        {filledCount > 0 ? (
          <button className="text-[10px] uppercase tracking-widest text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors">
            {copy.save} ({filledCount})
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      <div className="relative z-10 px-4 pb-24 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-center">
        {/* Interactive Outfit Flat-Lay Canvas */}
        <div className="flex flex-col items-center">
          <div className="relative w-80 min-h-[460px] bg-zinc-950/40 border border-zinc-900 rounded-[2.5rem] p-6 backdrop-blur-xl flex flex-col justify-between shadow-2xl">
            {/* Flat-Lay Title / Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-4">
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-zinc-500">
                {isAr ? 'لوحة التنسيق المسطحة' : 'Flat-Lay Canvas'}
              </span>
              <span className="text-[10px] text-zinc-700 font-medium">Elephante AI</span>
            </div>

            {/* Grid of Slots */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Accessories Slot (Top Bar) */}
              <div 
                onClick={() => setActiveZone('accessories')}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between p-3.5 ${
                  activeZone === 'accessories' 
                    ? 'border-white/30 bg-white/10' 
                    : zones.accessories.preview || zones.accessories.prompt 
                      ? 'border-zinc-800 bg-zinc-900/60' 
                      : 'border-zinc-900 border-dashed bg-zinc-950/30 hover:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">💍</span>
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase tracking-wider">
                      {isAr ? ZONE_AR.accessories.label : 'Accessories'}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate max-w-[180px]">
                      {zones.accessories.preview 
                        ? (isAr ? 'صورة منتج مرفقة' : 'Product Image Attached') 
                        : zones.accessories.prompt 
                          ? zones.accessories.prompt 
                          : (isAr ? ZONE_AR.accessories.hint : 'Watch, bag, hat…')}
                    </p>
                  </div>
                </div>
                {zones.accessories.preview ? (
                  <img src={zones.accessories.preview} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                ) : zones.accessories.prompt ? (
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-[9px] font-bold uppercase tracking-wider">
                    {isAr ? 'نص' : 'Text'}
                  </div>
                ) : (
                  <span className="text-[10px] text-zinc-600 font-bold group-hover:text-zinc-400 transition-colors uppercase tracking-widest">
                    {isAr ? '+ إضافة' : '+ Add'}
                  </span>
                )}
              </div>

              {/* Outerwear & Top side-by-side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Outerwear */}
                <div 
                  onClick={() => setActiveZone('outerwear')}
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between p-3.5 h-[130px] ${
                    activeZone === 'outerwear' 
                      ? 'border-white/30 bg-white/10' 
                      : zones.outerwear.preview || zones.outerwear.prompt 
                        ? 'border-zinc-800 bg-zinc-900/60' 
                        : 'border-zinc-900 border-dashed bg-zinc-950/30 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xl">🧥</span>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                      {isAr ? ZONE_AR.outerwear.label : 'Outerwear'}
                    </span>
                  </div>
                  {zones.outerwear.preview ? (
                    <img src={zones.outerwear.preview} className="w-full h-16 rounded-xl object-cover border border-white/10" alt="" />
                  ) : zones.outerwear.prompt ? (
                    <p className="text-[10px] text-zinc-300 font-medium italic truncate max-w-[120px]">
                      "{zones.outerwear.prompt}"
                    </p>
                  ) : (
                    <p className="text-[9px] text-zinc-600 italic">
                      {isAr ? ZONE_AR.outerwear.hint : 'Jacket, coat, blazer…'}
                    </p>
                  )}
                  {!zones.outerwear.preview && !zones.outerwear.prompt && (
                    <span className="text-[9px] text-zinc-600 font-bold group-hover:text-zinc-400 transition-colors uppercase tracking-widest mt-auto">
                      {isAr ? '+ إضافة' : '+ Add'}
                    </span>
                  )}
                </div>

                {/* Top */}
                <div 
                  onClick={() => setActiveZone('top')}
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between p-3.5 h-[130px] ${
                    activeZone === 'top' 
                      ? 'border-white/30 bg-white/10' 
                      : zones.top.preview || zones.top.prompt 
                        ? 'border-zinc-800 bg-zinc-900/60' 
                        : 'border-zinc-900 border-dashed bg-zinc-950/30 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xl">👕</span>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                      {isAr ? ZONE_AR.top.label : 'Top'}
                    </span>
                  </div>
                  {zones.top.preview ? (
                    <img src={zones.top.preview} className="w-full h-16 rounded-xl object-cover border border-white/10" alt="" />
                  ) : zones.top.prompt ? (
                    <p className="text-[10px] text-zinc-300 font-medium italic truncate max-w-[120px]">
                      "{zones.top.prompt}"
                    </p>
                  ) : (
                    <p className="text-[9px] text-zinc-600 italic">
                      {isAr ? ZONE_AR.top.hint : 'Shirt, tee, blouse…'}
                    </p>
                  )}
                  {!zones.top.preview && !zones.top.prompt && (
                    <span className="text-[9px] text-zinc-600 font-bold group-hover:text-zinc-400 transition-colors uppercase tracking-widest mt-auto">
                      {isAr ? '+ إضافة' : '+ Add'}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom */}
              <div 
                onClick={() => setActiveZone('bottom')}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between p-3.5 ${
                  activeZone === 'bottom' 
                    ? 'border-white/30 bg-white/10' 
                    : zones.bottom.preview || zones.bottom.prompt 
                      ? 'border-zinc-800 bg-zinc-900/60' 
                      : 'border-zinc-900 border-dashed bg-zinc-950/30 hover:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👖</span>
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase tracking-wider">
                      {isAr ? ZONE_AR.bottom.label : 'Bottom'}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate max-w-[180px]">
                      {zones.bottom.preview 
                        ? (isAr ? 'صورة منتج مرفقة' : 'Product Image Attached') 
                        : zones.bottom.prompt 
                          ? zones.bottom.prompt 
                          : (isAr ? ZONE_AR.bottom.hint : 'Pants, skirt, shorts…')}
                    </p>
                  </div>
                </div>
                {zones.bottom.preview ? (
                  <img src={zones.bottom.preview} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                ) : zones.bottom.prompt ? (
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-[9px] font-bold uppercase tracking-wider">
                    {isAr ? 'نص' : 'Text'}
                  </div>
                ) : (
                  <span className="text-[10px] text-zinc-600 font-bold group-hover:text-zinc-400 transition-colors uppercase tracking-widest">
                    {isAr ? '+ إضافة' : '+ Add'}
                  </span>
                )}
              </div>

              {/* Shoes */}
              <div 
                onClick={() => setActiveZone('shoes')}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between p-3.5 ${
                  activeZone === 'shoes' 
                    ? 'border-white/30 bg-white/10' 
                    : zones.shoes.preview || zones.shoes.prompt 
                      ? 'border-zinc-800 bg-zinc-900/60' 
                      : 'border-zinc-900 border-dashed bg-zinc-950/30 hover:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👟</span>
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase tracking-wider">
                      {isAr ? ZONE_AR.shoes.label : 'Shoes'}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate max-w-[180px]">
                      {zones.shoes.preview 
                        ? (isAr ? 'صورة منتج مرفقة' : 'Product Image Attached') 
                        : zones.shoes.prompt 
                          ? zones.shoes.prompt 
                          : (isAr ? ZONE_AR.shoes.hint : 'Sneakers, boots, heels…')}
                    </p>
                  </div>
                </div>
                {zones.shoes.preview ? (
                  <img src={zones.shoes.preview} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                ) : zones.shoes.prompt ? (
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-[9px] font-bold uppercase tracking-wider">
                    {isAr ? 'نص' : 'Text'}
                  </div>
                ) : (
                  <span className="text-[10px] text-zinc-600 font-bold group-hover:text-zinc-400 transition-colors uppercase tracking-widest">
                    {isAr ? '+ إضافة' : '+ Add'}
                  </span>
                )}
              </div>
            </div>

            {/* Mix & Match Button */}
            <div className="mt-6 border-t border-zinc-900 pt-4">
              <button
                type="button"
                onClick={handleMixAndMatch}
                disabled={mixLoading}
                className="w-full h-11 bg-white hover:bg-zinc-100 text-black rounded-xl text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                {mixLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-zinc-900 rounded-full animate-spin" />
                ) : (
                  <span>✨</span>
                )}
                {mixLoading 
                  ? (isAr ? 'جاري التنسيق...' : 'Matching items...') 
                  : (isAr ? 'تنسيق ذكي بالذكاء الاصطناعي' : 'AI Mix & Match')}
              </button>
            </div>
          </div>
        </div>

        {/* Zone inputs */}
        <div className="flex flex-col gap-3 lg:w-80 lg:pt-4">
          {ZONES.map((zone) => (
            <div
              key={zone.key}
              className={`transition-all duration-200 ${activeZone === zone.key ? 'ring-1 ring-white/20 rounded-2xl' : ''}`}
              onClick={() => !zones[zone.key].preview && !zones[zone.key].prompt && setActiveZone(zone.key)}
            >
              <ZoneInput
                zone={zone}
                item={zones[zone.key]}
                onChange={(update) => {
                  setActiveZone(zone.key)
                  patch(zone.key, update)
                }}
                onPhotoSelect={() => handlePhotoSelect(zone.key)}
                onConfirm={() => handleConfirm(zone.key)}
                onClear={() => handleClear(zone.key)}
                isAr={isAr}
                copy={copy}
              />
            </div>
          ))}

          {filledCount > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={handleTestOutfit}
                disabled={isLoading || !hasAnalyzablePhotos}
                className="w-full py-4 bg-white text-black font-bold text-[10px] uppercase tracking-widest rounded-2xl hover:bg-zinc-100 transition-colors active:scale-[0.98] min-h-[52px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? copy.consulting : hasAnalyzablePhotos ? copy.rate : copy.uploadPhotoToRate}
              </button>

              {attachedImageCount >= 2 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCompatibilityCheck}
                    disabled={compatLoading}
                    className="flex-1 py-3 border border-zinc-800 text-white font-bold text-[9px] uppercase tracking-widest rounded-xl hover:border-zinc-600 hover:bg-zinc-900/60 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                  >
                    {compatLoading ? (
                      <span className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin" />
                    ) : '◈'}
                    {isAr ? 'توافق CLIP' : 'CLIP Compat'}
                  </button>
                  <button
                    onClick={handleTryOn}
                    disabled={tryOnLoading}
                    className="flex-1 py-3 border border-zinc-800 text-white font-bold text-[9px] uppercase tracking-widest rounded-xl hover:border-zinc-600 hover:bg-zinc-900/60 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                  >
                    {tryOnLoading ? (
                      <span className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin" />
                    ) : '👗'}
                    {isAr ? 'تجربة افتراضية' : 'Try On'}
                  </button>
                </div>
              )}

              {compatScore && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <span className={`text-sm font-bold tabular-nums ${compatScore.score >= 70 ? 'text-white' : compatScore.score >= 45 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {compatScore.score}
                  </span>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-zinc-300">{compatScore.verdict}</p>
                    {compatScore.suggestion && (
                      <p className="text-[9px] text-zinc-500 mt-0.5 leading-relaxed">{compatScore.suggestion}</p>
                    )}
                  </div>
                  <span className="text-[8px] uppercase tracking-widest text-zinc-600">CLIP</span>
                </div>
              )}
            </div>
          )}

          {analysis && (
            <div className="mt-4 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Chat Thread */}
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 mb-0.5">
                        <img src="/logo.png" alt="" className="w-6 h-6 object-contain invert" />
                      </div>
                    )}
                    <div className={`max-w-[85%] px-4 py-3 text-[13px] leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-zinc-800 text-white rounded-2xl rounded-br-sm shadow-lg shadow-black/20' 
                        : 'bg-zinc-950/90 border border-zinc-800/50 text-zinc-200 rounded-2xl rounded-bl-sm backdrop-blur-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-end gap-2.5 justify-start">
                    <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                      <img src="/logo.png" alt="" className="w-6 h-6 object-contain invert" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-zinc-950/80 border border-zinc-800">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/10 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Analysis Dashboard (shown after AI initial response) */}
              {messages.length > 1 && (
                <div className="p-6 border border-zinc-800/80 rounded-[2.5rem] bg-zinc-950/60 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both shadow-2xl">
                  <h3 className="text-[10px] font-bold tracking-[0.4em] text-zinc-500 uppercase text-center mb-8">{copy.verdict}</h3>

                  <div className="flex justify-around mb-10">
                    <div className="flex flex-col items-center">
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-900" />
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-white transition-all duration-1000 ease-out"
                            style={{ strokeDasharray: `${2 * Math.PI * 28}`, strokeDashoffset: `${2 * Math.PI * 28 * (1 - displayedMatchScore / 100)}` }}
                          />
                        </svg>
                        <span className="absolute text-sm font-medium text-white">{displayedMatchScore}%</span>
                      </div>
                      <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-600 mt-2.5">{copy.match}</p>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-900" />
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-400 transition-all duration-1000 ease-out"
                            style={{ strokeDasharray: `${2 * Math.PI * 28}`, strokeDashoffset: `${2 * Math.PI * 28 * (1 - displayedProportionScore / 100)}` }}
                          />
                        </svg>
                        <span className="absolute text-sm font-medium text-white">{displayedProportionScore}%</span>
                      </div>
                      <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-600 mt-2.5">{copy.proportion}</p>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-900" />
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-500 transition-all duration-1000 ease-out"
                            style={{ strokeDasharray: `${2 * Math.PI * 28}`, strokeDashoffset: `${2 * Math.PI * 28 * (1 - displayedHarmonyScore / 100)}` }}
                          />
                        </svg>
                        <span className="absolute text-sm font-medium text-white">{displayedHarmonyScore}%</span>
                      </div>
                      <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-600 mt-2.5">{copy.harmony}</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {analysis.skin_tone_feedback && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                          <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-600">{copy.skinTone}</p>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed pl-3.5">{analysis.skin_tone_feedback}</p>
                      </div>
                    )}

                    {analysis.silhouette_feedback && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                          <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-600">{copy.silhouette}</p>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed italic pl-3.5">{analysis.silhouette_feedback}</p>
                      </div>
                    )}

                    {analysis.why_it_works && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                          <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-600">{copy.whyWorks}</p>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed pl-3.5">{analysis.why_it_works}</p>
                      </div>
                    )}

                    {analysis.styling_tip && (
                      <div className="bg-white/5 rounded-[2rem] p-5 border border-white/10 shadow-inner">
                        <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-500 mb-2.5">{copy.tip}</p>
                        <p className="text-xs text-zinc-200 leading-relaxed font-medium">{analysis.styling_tip}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tryOnResult && (
            <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 mb-3">{isAr ? 'نتيجة التجربة' : 'Try-On Result'}</p>
              <div className="rounded-[2rem] overflow-hidden border border-zinc-800 bg-zinc-950">
                <img src={tryOnResult} alt="Try-on result" className="w-full object-cover" />
              </div>
            </div>
          )}

          {matchError && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
              <p className="text-xs text-red-300">{matchError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OutfitBuilder() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <span className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    }>
      <OutfitBuilderContent />
    </Suspense>
  )
}
