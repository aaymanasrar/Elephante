'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ParticleCanvas from '@/components/ParticleCanvas'
import LoadingSpinner from '@/components/LoadingSpinner'
import { filterOutfits } from '@/lib/filterOutfits'
import { useRequireUser } from '@/hooks/useRequireUser'
import { getFriendlyDataError } from '@/lib/supabaseErrors'
import { canUseNextImage } from '@/lib/image'
import { useLocale } from '@/lib/locale-context'
import { useArabicTranslations } from '@/hooks/useArabicTranslations'
import type { GeneratedOutfitVariant, Outfit } from '@/types/outfit'
import type { Profile } from '@/types/profile'

type RawClosetItem = {
  id: number
  category: string
  item_type: string | null
  item_name: string | null
  brand: string | null
  color: string | null
  occasion: string | null
  style_query: string | null
  image_url: string | null
  storage_path: string | null
  created_at: string | null
}

type PersonalCategory = 'all' | 'tops' | 'bottoms' | 'shoes' | 'outerwear' | 'accessories'
type PersonalView = 'wardrobe' | 'dress-today'

type WeatherInfo = { city: string; temperature_c: number; condition: string; wind_kph: number }
type OutfitSuggestion = { outfit_name: string; selected_items: (RawClosetItem & { reason: string })[]; ai_verdict: string }

const PERSONAL_CATEGORIES: { id: PersonalCategory; label: string; labelAr: string }[] = [
  { id: 'all', label: 'All', labelAr: 'الكل' },
  { id: 'tops', label: 'Tops', labelAr: 'علويات' },
  { id: 'bottoms', label: 'Bottoms', labelAr: 'سفليات' },
  { id: 'shoes', label: 'Shoes', labelAr: 'أحذية' },
  { id: 'outerwear', label: 'Outerwear', labelAr: 'طبقة خارجية' },
  { id: 'accessories', label: 'Accessories', labelAr: 'إكسسوارات' },
]

const OCCASIONS: { id: string; label: string; labelAr: string; icon: string }[] = [
  { id: 'Casual', label: 'Casual', labelAr: 'يومي', icon: '☀️' },
  { id: 'Office', label: 'Office', labelAr: 'مكتب', icon: '💼' },
  { id: 'Dinner', label: 'Dinner', labelAr: 'عشاء', icon: '🍽️' },
  { id: 'Gym', label: 'Gym', labelAr: 'رياضة', icon: '🏋️' },
  { id: 'Date', label: 'Date', labelAr: 'موعد', icon: '❤️' },
  { id: 'Wedding', label: 'Wedding', labelAr: 'زفاف', icon: '💍' },
  { id: 'Travel', label: 'Travel', labelAr: 'سفر', icon: '✈️' },
  { id: 'Beach', label: 'Beach', labelAr: 'شاطئ', icon: '🏖️' },
]

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

const closetCopy = {
  en: {
    back: 'Back',
    closet: 'Closet',
    style: 'Style',
    color: 'Color',
    search: 'Search — wedding, office, white shirt, suit...',
    clearSearch: 'Clear search',
    uploadOutfit: 'Upload outfit photo',
    uploadHint: 'Extract items from the photo directly into your closet.',
    uploadCta: 'Choose photo',
    original: 'Original',
    mannequin: 'Mannequin',
    extracting: 'Digitizing closet garments...',
    rendering: 'Building mannequin...',
    saving: 'Saving to your closet...',
    saved: 'Saved to your closet',
    uploadError: 'Could not import outfit photo.',
    missingIntro: 'Found part of the outfit. Please complete the look before rendering.',
    addMissing: 'Add and save',
    missingTop: 'What top should I add?',
    missingTopPlaceholder: 'White linen camp-collar shirt',
    missingBottom: 'What bottom should I add?',
    missingBottomPlaceholder: 'Straight black tailored trousers',
    missingShoes: 'What shoes should I add?',
    missingShoesPlaceholder: 'Black leather loafers',
    allLooks: 'All',
    allLooksSub: 'Everything saved in your closet, together.',
    curatedLooks: 'Elephante Curated',
    curatedLooksSub: 'Looks saved from Elephante edits and archive curation.',
    stylistLooks: 'AI Stylist',
    stylistLooksSub: 'Looks generated from your AI styling requests.',
    personalLooks: 'My Clothes',
    personalLooksSub: 'Individual garments extracted from your uploaded photos.',
    curatedSource: 'Curated',
    stylistSource: 'AI Stylist',
    personalSource: 'Personal',
    emptyAllLooks: 'No saved looks yet',
    emptyCuratedLooks: 'No curated Elephante looks saved',
    emptyStylistLooks: 'No AI Stylist looks saved',
    emptyPersonalLooks: 'No clothes in your wardrobe yet',
    myWardrobe: 'My Wardrobe',
    dressToday: 'Dress for Today',
    categoryAll: 'All',
    selectItems: 'Select',
    cancelSelect: 'Cancel',
    buildOutfit: (n: number) => `Build Outfit (${n})`,
    cityPlaceholder: 'Enter your city…',
    getWeather: 'Check Weather',
    checkingWeather: 'Checking…',
    weatherError: 'Could not get weather.',
    occasion: 'Occasion',
    findOutfit: 'Find My Outfit',
    findingOutfit: 'Styling your look…',
    suggestError: 'Could not suggest an outfit. Try again.',
    emptySuggest: 'Add more clothes to get outfit suggestions.',
    todaysLook: "Today's Look",
    yourOutfits: 'Your outfits',
    yourOutfitsSub: 'Uploaded looks you can reuse as the starting point.',
    elephanteLooks: 'Elephante looks',
    elephanteLooksSub: 'Saved curated outfits and generated looks.',
    buildFromThis: 'Build from this',
    openLook: 'Open look',
    emptyUserOutfits: 'No uploaded outfits yet',
    emptyElephanteLooks: 'No Elephante looks saved',
    loading: 'Loading Closet...',
    emptySearch: 'No matching looks',
    emptySaved: 'No saved outfits',
    filtered: 'filtered',
    sorted: 'sorted by your aesthetic',
    savedLook: 'Saved Look',
    aiLook: 'Styled Look',
    noImage: 'No image',
    loadError: 'We could not load your closet.',
  },
  ar: {
    back: 'رجوع',
    closet: 'الخزانة',
    style: 'النمط',
    color: 'اللون',
    search: 'ابحث — زفاف، مكتب، قميص أبيض، بدلة...',
    clearSearch: 'مسح البحث',
    uploadOutfit: 'رفع صورة ملابسك',
    uploadHint: 'استخراج القطع من الصورة مباشرة وحفظها في خزانتك.',
    uploadCta: 'اختر صورة',
    original: 'الأصلية',
    mannequin: 'المانيكان',
    extracting: 'رقمنة ملابسك الشخصية...',
    rendering: 'جارٍ بناء المانيكان...',
    saving: 'جارٍ الحفظ في الخزانة...',
    saved: 'حُفظت في خزانتك',
    uploadError: 'لم نتمكن من استيراد صورة الإطلالة.',
    missingIntro: 'وجدت جزءًا من الإطلالة. أضف القطع الناقصة قبل بناء المانيكان.',
    addMissing: 'أضف واحفظ',
    missingTop: 'ما القطعة العلوية التي أضيفها؟',
    missingTopPlaceholder: 'قميص كتان أبيض بياقة مفتوحة',
    missingBottom: 'ما القطعة السفلية التي أضيفها؟',
    missingBottomPlaceholder: 'بنطال أسود مستقيم ومفصل',
    missingShoes: 'ما الحذاء الذي أضيفه؟',
    missingShoesPlaceholder: 'لوفر جلد أسود',
    allLooks: 'الكل',
    allLooksSub: 'كل الإطلالات المحفوظة في خزانتك معًا.',
    curatedLooks: 'مختارات Elephante',
    curatedLooksSub: 'إطلالات محفوظة من تنسيق وأرشيف Elephante.',
    stylistLooks: 'المنسق الذكي',
    stylistLooksSub: 'إطلالات وُلّدت من طلباتك للمنسق الذكي.',
    personalLooks: 'ملابسي الشخصية',
    personalLooksSub: 'قطع ملابس فردية تم استخراجها من صورك المرفوعة.',
    curatedSource: 'مختارة',
    stylistSource: 'المنسق الذكي',
    personalSource: 'شخصية',
    emptyAllLooks: 'لا توجد إطلالات محفوظة بعد',
    emptyCuratedLooks: 'لا توجد مختارات محفوظة من Elephante',
    emptyStylistLooks: 'لا توجد إطلالات من المنسق الذكي',
    emptyPersonalLooks: 'لا توجد ملابس في خزانتك بعد',
    myWardrobe: 'خزانتي',
    dressToday: 'إطلالة اليوم',
    categoryAll: 'الكل',
    selectItems: 'تحديد',
    cancelSelect: 'إلغاء',
    buildOutfit: (n: number) => `ابنِ إطلالة (${n})`,
    cityPlaceholder: 'أدخل مدينتك…',
    getWeather: 'تحقق من الطقس',
    checkingWeather: 'جارٍ التحقق…',
    weatherError: 'تعذّر الحصول على الطقس.',
    occasion: 'المناسبة',
    findOutfit: 'ابحث عن إطلالتي',
    findingOutfit: 'جارٍ تنسيق إطلالتك…',
    suggestError: 'تعذّر اقتراح إطلالة. حاول مجدداً.',
    emptySuggest: 'أضف المزيد من الملابس للحصول على اقتراحات.',
    todaysLook: 'إطلالة اليوم',
    yourOutfits: 'إطلالاتك',
    yourOutfitsSub: 'إطلالات رفعتها وتستطيع البناء عليها.',
    elephanteLooks: 'إطلالات Elephante',
    elephanteLooksSub: 'إطلالات منسقة أو محفوظة من Elephante.',
    buildFromThis: 'ابنِ عليها',
    openLook: 'فتح الإطلالة',
    emptyUserOutfits: 'لا توجد إطلالات مرفوعة بعد',
    emptyElephanteLooks: 'لا توجد إطلالات محفوظة من Elephante',
    loading: 'جارٍ تحميل الخزانة...',
    emptySearch: 'لا توجد إطلالات مطابقة',
    emptySaved: 'لا توجد إطلالات محفوظة',
    filtered: 'مصفاة',
    sorted: 'مرتبة حسب ذوقك',
    savedLook: 'إطلالة محفوظة',
    aiLook: 'إطلالة منسقة',
    noImage: 'لا توجد صورة',
    loadError: 'لم نتمكن من تحميل الخزانة.',
  },
} as const

type SavedOutfitRow = {
  outfit_id?: string | number | null
  outfit_ref?: string | number | null
  source?: string | null
}

type ClosetSource = 'manual' | 'ai_stylist' | 'excel' | 'db' | 'unknown'
type ClosetSection = 'all' | 'curated' | 'stylist' | 'personal'
type ClosetOutfit = Outfit & { _closetSource?: ClosetSource }
type ClosetProfile = Pick<Profile, 'gender' | 'skin_tone' | 'body_shape' | 'height_category' | 'style_preference' | 'preferred_palette'>

type MissingOutfitPiece = 'top_wear' | 'bottom_wear' | 'shoes'
type ImportStatus = 'idle' | 'extracting' | 'needs_details' | 'rendering' | 'saving' | 'saved' | 'error'

type ImportPreview = {
  originalUrl: string | null
  mannequinUrl: string | null
  outfit: GeneratedOutfitVariant | null
  missingItems: MissingOutfitPiece[]
  missingAnswers: Partial<Record<MissingOutfitPiece, string>>
  status: ImportStatus
  message: string
}

const MAX_IMPORT_IMAGE_EDGE = 1400
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(String(event.target?.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Could not read image.'))
    reader.readAsDataURL(file)
  })
}

async function createImportImageDataUrl(file: File) {
  const fallback = () => readFileAsDataUrl(file)
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = document.createElement('img')
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Could not load image.'))
      nextImage.src = objectUrl
    })

    const maxEdge = Math.max(image.naturalWidth, image.naturalHeight)
    if (!maxEdge) return fallback()

    const scale = Math.min(1, MAX_IMPORT_IMAGE_EDGE / maxEdge)
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

function normalizeClosetSource(source?: string | null): ClosetSource {
  if (source === 'manual' || source === 'ai_stylist' || source === 'excel' || source === 'db') return source
  return 'unknown'
}

function parseClosetSection(value?: string | null): ClosetSection | null {
  return value === 'all' || value === 'curated' || value === 'stylist' || value === 'personal' ? value : null
}

function initialClosetSection(): ClosetSection {
  if (typeof window === 'undefined') return 'all'

  const urlSection = parseClosetSection(new URLSearchParams(window.location.search).get('section'))
  if (urlSection) return urlSection

  try {
    return parseClosetSection(window.localStorage.getItem('elephante_closet_section')) || 'all'
  } catch {
    return 'all'
  }
}

function closetSectionForSource(source?: ClosetSource): Exclude<ClosetSection, 'all'> {
  if (source === 'manual') return 'personal'
  if (source === 'ai_stylist') return 'stylist'
  return 'curated'
}

function inferClosetSource(source?: string | null, outfit?: Outfit | null): ClosetSource {
  const normalized = normalizeClosetSource(source)
  if (normalized !== 'unknown') return normalized
  if (!outfit) return normalized

  const sourceId = String(outfit.source_id || '').toLowerCase()
  const outfitText = [
    outfit.style_category,
    outfit.occasions,
    outfit.when_to_wear,
    outfit.outfit_details,
  ].filter(Boolean).join(' ').toLowerCase()

  if (sourceId.includes('manual') || /uploaded outfit|uploaded look|closet upload|user supplied missing pieces|repeat this uploaded look/.test(outfitText)) {
    return 'manual'
  }
  if (sourceId.includes('ai_stylist') || sourceId.startsWith('ai_')) return 'ai_stylist'
  return normalized
}

function outfitFromGenerated(id: string, generated: GeneratedOutfitVariant, imageUrl: string | null, closetSource: ClosetSource): ClosetOutfit {
  return {
    id,
    _source: 'excel',
    _closetSource: closetSource,
    image_url: imageUrl,
    outfit_name: generated.outfit_name,
    style_category: generated.outfit_name || generated.style || 'Uploaded Closet Look',
    style: generated.style,
    color_scheme: generated.color_scheme,
    top_wear: generated.top_wear,
    bottom_wear: generated.bottom_wear,
    shoes: generated.shoes,
    accessories: generated.accessories,
    outerwear: generated.outerwear,
    occasions: generated.occasions,
    when_to_wear: generated.when_to_wear,
    outfit_details: generated.outfit_details,
    material_top: generated.material_top,
    material_bottom: generated.material_bottom,
    material_shoes: generated.material_shoes,
    hex_colors: generated.key_colors,
    gender: generated.gender,
  }
}

function buildFromOutfitPrompt(outfit: Outfit) {
  const label = outfit.outfit_name || outfit.style_category || outfit.style || 'this outfit'
  const pieces = [
    outfit.top_wear,
    outfit.bottom_wear,
    outfit.shoes,
    outfit.outerwear,
    outfit.accessories,
  ].filter(Boolean).join(', ')
  const palette = outfit.color_scheme ? ` Palette: ${outfit.color_scheme}.` : ''
  return `Build something from my uploaded outfit "${label}"${pieces ? ` using these pieces as the base: ${pieces}.` : '.'}${palette} Do not start from Elephante curated looks unless you need a complementary piece.`
}

function asMissingOutfitPieces(value: unknown): MissingOutfitPiece[] {
  if (!Array.isArray(value)) return []
  const ids = value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'id' in item) return (item as { id?: unknown }).id
      return null
    })
    .filter((item): item is MissingOutfitPiece => item === 'top_wear' || item === 'bottom_wear' || item === 'shoes')

  return Array.from(new Set(ids))
}

function completeOutfitWithMissingAnswers(outfit: GeneratedOutfitVariant, answers: Partial<Record<MissingOutfitPiece, string>>): GeneratedOutfitVariant {
  const completed = { ...outfit }
  const additions: string[] = []

  for (const field of ['top_wear', 'bottom_wear', 'shoes'] as const) {
    const value = answers[field]?.trim()
    if (!value) continue

    completed[field] = value
    additions.push(`${field.replace('_wear', '').replace('_', ' ')}: ${value}`)
  }

  if (additions.length) {
    completed.outfit_details = [
      completed.outfit_details,
      `User supplied missing pieces: ${additions.join('; ')}.`,
    ].filter(Boolean).join('\n\n')
  }

  return completed
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
  const { isAr } = useLocale()
  const t = isAr ? closetCopy.ar : closetCopy.en
  const { user, loading: userLoading, error: authError } = useRequireUser('/login')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [allOutfits, setAllOutfits] = useState<ClosetOutfit[]>([])
  const [displayed, setDisplayed] = useState<ClosetOutfit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [activeLifestyles, setActiveLifestyles] = useState<string[]>([])
  const [activeAesthetics, setActiveAesthetics] = useState<string[]>([])
  const [activeSection, setActiveSection] = useState<ClosetSection>('all')
  const [mounted, setMounted] = useState(false)
  const [userPalette, setUserPalette] = useState<string[]>([])
  const [profile, setProfile] = useState<ClosetProfile | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview>({
    originalUrl: null,
    mannequinUrl: null,
    outfit: null,
    missingItems: [],
    missingAnswers: {},
    status: 'idle',
    message: '',
  })
  const [error, setError] = useState('')

  // Personal wardrobe state
  const [rawClosetItems, setRawClosetItems] = useState<RawClosetItem[]>([])
  const [personalCategory, setPersonalCategory] = useState<PersonalCategory>('all')
  const [personalView, setPersonalView] = useState<PersonalView>('wardrobe')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  // Dress for Today state
  const [cityInput, setCityInput] = useState('')
  const [weatherData, setWeatherData] = useState<WeatherInfo | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [selectedOccasion, setSelectedOccasion] = useState('Casual')
  const [outfitSuggestion, setOutfitSuggestion] = useState<OutfitSuggestion | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestionError, setSuggestionError] = useState('')

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      setLoading(true)
      setError('')

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('gender, skin_tone, preferred_palette, body_shape, height_category, style_preference')
          .eq('id', user.id)
          .single()

        if (profileError) {
          setError(getFriendlyDataError(profileError.message, t.loadError))
        }

        const closetProfile = profileData as ClosetProfile | null
        setProfile(closetProfile)
        const palettes = closetProfile?.preferred_palette
          ? closetProfile.preferred_palette.split(',').map((value) => value.trim().toLowerCase())
          : []
        setUserPalette(palettes)

        const { data: savedRows, error: savedError } = await supabase
          .from('saved_outfits')
          .select('outfit_ref, source, outfit_id')
          .eq('user_id', user.id)

        const { data: closetItems, error: closetError } = await supabase
          .from('closet_items')
          .select('*')
          .eq('user_id', user.id)

        if (savedError) {
          setError(getFriendlyDataError(savedError.message, t.loadError))
          setAllOutfits([])
          return
        }
        if (closetError) {
          setError(getFriendlyDataError(closetError.message, t.loadError))
          setAllOutfits([])
          return
        }

        setRawClosetItems((closetItems || []) as RawClosetItem[])

        const mappedItems: ClosetOutfit[] = (closetItems || []).map((item) => ({
          id: `item_${item.id}`,
          image_url: item.image_url,
          outfit_name: item.item_name,
          style_category: item.item_name,
          style: item.item_type,
          color_scheme: item.color,
          occasions: item.occasion,
          outfit_details: item.style_query,
          top_wear: item.category === 'tops' ? item.item_name : null,
          bottom_wear: item.category === 'bottoms' ? item.item_name : null,
          shoes: item.category === 'shoes' ? item.item_name : null,
          outerwear: item.category === 'outerwear' ? item.item_name : null,
          accessories: item.category === 'accessories' ? item.item_name : null,
          _closetSource: 'manual',
        }))

        const allSaved: ClosetOutfit[] = [...mappedItems]

        const resolveSavedRef = (row: SavedOutfitRow) => {
          if (row.outfit_id) return String(row.outfit_id)
          if (row.outfit_ref) return String(row.outfit_ref)
          return null
        }

        const validRefs = savedRows?.length
          ? [
              ...new Set(
                savedRows
                  .map((row) => {
                    return resolveSavedRef(row)
                  })
                  .filter((ref): ref is string => ref !== null)
              ),
            ]
          : []

        if (validRefs.length > 0) {
          const numericRefs = validRefs
            .map((ref) => Number(ref))
            .filter((ref) => Number.isInteger(ref) && ref > 0)
          const uuidRefs = validRefs.filter((ref) => UUID_PATTERN.test(ref))

          const [excelByIdResult, excelBySourceResult, legacyResult] = await Promise.all([
            uuidRefs.length
              ? supabase.from('excel_outfits').select('*').in('id', uuidRefs)
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

          const seen = new Set<string>()
          for (const row of savedRows as SavedOutfitRow[]) {
            const ref = resolveSavedRef(row)
            if (!ref || seen.has(ref)) continue

            const excelCandidate = excelById.get(ref) || excelBySourceId.get(ref)
            const legacyCandidate = legacyById.get(ref)
            const inferredFromExcel = inferClosetSource(row.source, excelCandidate)
            const shouldPreferExcel = inferredFromExcel === 'excel' || inferredFromExcel === 'ai_stylist' || inferredFromExcel === 'manual'
            const outfit = shouldPreferExcel
              ? excelCandidate || legacyCandidate
              : legacyCandidate || excelCandidate
            if (!outfit) continue

            const closetSource = inferClosetSource(row.source, outfit)
            if (closetSource === 'manual') continue

            allSaved.push({ ...outfit, _closetSource: closetSource })
            seen.add(ref)
          }
        }

        setAllOutfits(allSaved)
      } catch {
        setError(t.loadError)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, t.loadError])

  useEffect(() => {
    return () => {
      if (importPreview.originalUrl?.startsWith('blob:')) URL.revokeObjectURL(importPreview.originalUrl)
    }
  }, [importPreview.originalUrl])

  useEffect(() => {
    setMounted(true)

    const urlSection = parseClosetSection(new URLSearchParams(window.location.search).get('section'))
    if (urlSection) {
      setActiveSection(urlSection)
      return
    }

    try {
      const savedSection = parseClosetSection(window.localStorage.getItem('elephante_closet_section'))
      if (savedSection) {
        setActiveSection(savedSection)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted) return

    try {
      window.localStorage.setItem('elephante_closet_section', activeSection)
    } catch {}

    const url = new URL(window.location.href)
    if (activeSection === 'all') {
      url.searchParams.delete('section')
    } else {
      url.searchParams.set('section', activeSection)
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [activeSection, mounted])

  const translateTexts = displayed.flatMap((outfit) => [
    outfit.style_category,
    outfit.outfit_name,
    outfit.style,
    outfit.aesthetic,
    outfit.top_wear,
    outfit.bottom_wear,
    outfit.shoes,
  ])
  const tr = useArabicTranslations([
    ...LIFESTYLE.map((item) => item.label),
    ...AESTHETICS.map((item) => item.label),
    ...translateTexts,
  ], isAr)

  useEffect(() => {
    setDisplayed(filterOutfits({
      outfits: allOutfits,
      activeLifestyles,
      activeAesthetics,
      searchQuery,
      userPalette,
    }) as ClosetOutfit[])
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

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not signed in. Please refresh and try again.')
    return { Authorization: `Bearer ${session.access_token}` }
  }

  const filteredPersonalItems = personalCategory === 'all'
    ? rawClosetItems
    : rawClosetItems.filter((item) => item.category === personalCategory)

  const toggleItemSelection = (id: number) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBuildOutfit = () => {
    if (selectedItemIds.size === 0) return
    router.push(`/outfit-builder?preselect=${Array.from(selectedItemIds).join(',')}`)
  }

  const fetchWeather = async () => {
    if (!cityInput.trim()) return
    setWeatherLoading(true)
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(cityInput.trim())}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setWeatherData(data as WeatherInfo)
    } catch {
      setWeatherData(null)
    } finally {
      setWeatherLoading(false)
    }
  }

  const handleSuggestOutfit = async () => {
    if (rawClosetItems.length === 0) return
    setSuggestionLoading(true)
    setSuggestionError('')
    setOutfitSuggestion(null)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch('/api/outfit-suggest-from-closet', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weather: weatherData,
          occasion: selectedOccasion,
          closet_items: rawClosetItems,
          user_profile: profile,
          language: isAr ? 'ar' : 'en',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || t.suggestError)
      setOutfitSuggestion(data as OutfitSuggestion)
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : t.suggestError)
    } finally {
      setSuggestionLoading(false)
    }
  }

  const handleOutfitPhotoImport = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return

    if (importPreview.originalUrl?.startsWith('blob:')) URL.revokeObjectURL(importPreview.originalUrl)
    const originalUrl = URL.createObjectURL(file)
    setActiveSection('personal')
    setImportPreview({
      originalUrl,
      mannequinUrl: null,
      outfit: null,
      missingItems: [],
      missingAnswers: {},
      status: 'extracting',
      message: t.extracting,
    })

    try {
      const imageUrl = await createImportImageDataUrl(file)
      const authHeaders = await getAuthHeaders()

      const importResponse = await fetch('/api/closet/outfit-from-photo', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          gender: profile?.gender || 'male',
          skin_tone: profile?.skin_tone || undefined,
          body_shape: profile?.body_shape || undefined,
          height: profile?.height_category || undefined,
          style_pref: profile?.style_preference || undefined,
          language: isAr ? 'ar' : 'en',
        }),
      })

      const importData = await importResponse.json()
      if (!importResponse.ok || importData.error) throw new Error(importData.error || t.uploadError)

      if (importData.status === 'complete' && Array.isArray(importData.imported_items)) {
        const mappedItems = importData.imported_items.map((item: any) => ({
          id: `item_${item.id}`,
          image_url: item.image_url,
          outfit_name: item.item_name,
          style_category: item.item_name,
          style: item.item_type,
          color_scheme: item.color,
          occasions: item.occasion,
          outfit_details: item.style_query,
          top_wear: item.category === 'tops' ? item.item_name : null,
          bottom_wear: item.category === 'bottoms' ? item.item_name : null,
          shoes: item.category === 'shoes' ? item.item_name : null,
          outerwear: item.category === 'outerwear' ? item.item_name : null,
          accessories: item.category === 'accessories' ? item.item_name : null,
          _closetSource: 'manual',
        }))

        setAllOutfits((prev) => [...mappedItems, ...prev])
        setSearchQuery('')
        setActiveLifestyles([])
        setActiveAesthetics([])
        setActiveSection('personal')
        setImportPreview({
          originalUrl: null,
          mannequinUrl: null,
          outfit: null,
          missingItems: [],
          missingAnswers: {},
          status: 'idle',
          message: '',
        })
      } else {
        throw new Error(t.uploadError)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t.uploadError
      setImportPreview((previous) => ({ ...previous, status: 'error', message }))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const pillBase = 'flex-shrink-0 px-4 py-2 rounded-full border text-[10px] uppercase tracking-widest font-semibold transition-all duration-300 whitespace-nowrap min-h-[36px] flex items-center'
  const pillOn = 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]'
  const pillOff = 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
  const importBusy = importPreview.status === 'extracting' || importPreview.status === 'rendering' || importPreview.status === 'saving'
  const displayedPersonalOutfits = displayed.filter((outfit) => closetSectionForSource(outfit._closetSource) === 'personal')
  const displayedStylistOutfits = displayed.filter((outfit) => closetSectionForSource(outfit._closetSource) === 'stylist')
  const displayedCuratedOutfits = displayed.filter((outfit) => closetSectionForSource(outfit._closetSource) === 'curated')
  const sectionedOutfits: Record<Exclude<ClosetSection, 'all'>, ClosetOutfit[]> = {
    curated: displayedCuratedOutfits,
    stylist: displayedStylistOutfits,
    personal: displayedPersonalOutfits,
  }
  const hasActiveFilters = Boolean(searchQuery.trim() || activeLifestyles.length > 0 || activeAesthetics.length > 0)
  const activeSectionOutfits = activeSection === 'all' ? displayed : sectionedOutfits[activeSection]
  const closetSections: Record<ClosetSection, { id: ClosetSection; label: string; description: string; count: number; empty: string }> = {
    all: {
      id: 'all',
      label: t.allLooks,
      description: t.allLooksSub,
      count: displayed.length,
      empty: t.emptyAllLooks,
    },
    curated: {
      id: 'curated',
      label: t.curatedLooks,
      description: t.curatedLooksSub,
      count: displayedCuratedOutfits.length,
      empty: t.emptyCuratedLooks,
    },
    stylist: {
      id: 'stylist',
      label: t.stylistLooks,
      description: t.stylistLooksSub,
      count: displayedStylistOutfits.length,
      empty: t.emptyStylistLooks,
    },
    personal: {
      id: 'personal',
      label: t.personalLooks,
      description: t.personalLooksSub,
      count: rawClosetItems.length,
      empty: t.emptyPersonalLooks,
    },
  }
  const closetSectionList = [closetSections.all, closetSections.curated, closetSections.stylist, closetSections.personal]
  const activeSectionMeta = closetSections[activeSection]

  const sourceLabelForOutfit = (outfit: ClosetOutfit) => {
    const section = closetSectionForSource(outfit._closetSource)
    if (section === 'personal') return t.personalSource
    if (section === 'stylist') return t.stylistSource
    return t.curatedSource
  }

  const renderWardrobeView = () => {
    const catCounts: Record<string, number> = { all: rawClosetItems.length }
    for (const item of rawClosetItems) {
      if (item.category) catCounts[item.category] = (catCounts[item.category] || 0) + 1
    }

    return (
      <div className="space-y-3">
        {/* Category tabs + select toggle */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide flex-1">
            {PERSONAL_CATEGORIES.map((cat) => {
              const count = catCounts[cat.id === 'all' ? 'all' : cat.id] || 0
              const isActive = personalCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setPersonalCategory(cat.id)}
                  className={`flex-shrink-0 h-8 px-3 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-black'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {isAr ? cat.labelAr : cat.label}
                  {count > 0 && (
                    <span className={`text-[8px] font-semibold ${isActive ? 'text-zinc-500' : 'text-zinc-700'}`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => { setSelectMode(!selectMode); setSelectedItemIds(new Set()) }}
            className={`flex-shrink-0 h-8 px-3 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all duration-200 border ${
              selectMode ? 'bg-white text-black border-white' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {selectMode ? t.cancelSelect : t.selectItems}
          </button>
        </div>

        {/* Catalog grid */}
        <div className="grid grid-cols-3 gap-2">
          {renderPersonalUploadCard()}
          {filteredPersonalItems.map((item) => {
            const isSelected = selectedItemIds.has(item.id)
            const label = item.item_name || (isAr ? 'قطعة' : 'Item')
            return (
              <div
                key={item.id}
                className="group cursor-pointer"
                onClick={() => {
                  if (selectMode) toggleItemSelection(item.id)
                  else router.push(`/outfit-builder?preselect=${item.id}`)
                }}
              >
                <div className={`relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900/80 border transition-all duration-300 ${
                  isSelected
                    ? 'border-white shadow-[0_0_0_2px_rgba(255,255,255,0.5)]'
                    : 'border-zinc-800/60 group-hover:border-zinc-600'
                }`}>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={label}
                      className="w-full h-full object-contain p-1"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700 text-[9px] uppercase tracking-widest">
                      {isAr ? 'لا صورة' : 'No image'}
                    </div>
                  )}
                  {selectMode ? (
                    <div className={`absolute top-2 ${isAr ? 'left-2' : 'right-2'} w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-white border-white' : 'border-zinc-400 bg-black/60'
                    }`}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-300 truncate">{item.category}</p>
                    </div>
                  )}
                </div>
                <div className="mt-1.5">
                  <p className="text-[9px] text-zinc-500 truncate leading-snug group-hover:text-zinc-300 transition-colors">{label}</p>
                  {item.color ? <p className="text-[8px] text-zinc-800 truncate">{item.color}</p> : null}
                </div>
              </div>
            )
          })}
          {filteredPersonalItems.length === 0 && rawClosetItems.length > 0 ? (
            <div className="col-span-3 py-8 text-center">
              <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-800">{isAr ? 'لا توجد قطع في هذا القسم' : 'No items in this category'}</p>
            </div>
          ) : null}
        </div>

        {/* Build outfit floating CTA */}
        {selectMode && selectedItemIds.size > 0 ? (
          <div className="sticky bottom-24 z-30 flex justify-center pt-2">
            <button
              onClick={handleBuildOutfit}
              className="h-12 px-6 bg-white text-black rounded-2xl text-[10px] font-extrabold uppercase tracking-widest shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:bg-zinc-100 active:scale-[0.97] transition-all"
            >
              {t.buildOutfit(selectedItemIds.size)}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  const renderDressForTodayView = () => {
    const conditionIcon = !weatherData ? null
      : /rain/i.test(weatherData.condition) ? '🌧️'
      : /cloud/i.test(weatherData.condition) ? '☁️'
      : /snow/i.test(weatherData.condition) ? '❄️'
      : /thunder/i.test(weatherData.condition) ? '⛈️'
      : /fog|mist/i.test(weatherData.condition) ? '🌫️'
      : '☀️'

    return (
      <div className="space-y-5">
        {/* City / weather */}
        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-600">{isAr ? '📍 مدينتك' : '📍 Your City'}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void fetchWeather()}
              placeholder={t.cityPlaceholder}
              dir={isAr ? 'rtl' : 'ltr'}
              className={`flex-1 bg-zinc-900/80 border border-zinc-800 text-white placeholder-zinc-700 text-sm rounded-xl py-2.5 outline-none focus:border-white/30 transition-all ${isAr ? 'pr-4 text-right' : 'pl-4'}`}
            />
            <button
              onClick={() => void fetchWeather()}
              disabled={!cityInput.trim() || weatherLoading}
              className="h-10 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest disabled:opacity-40 transition-colors flex-shrink-0"
            >
              {weatherLoading ? t.checkingWeather : t.getWeather}
            </button>
          </div>
          {weatherData ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-2xl">{conditionIcon}</span>
              <div>
                <p className="text-white text-sm font-semibold">{weatherData.city}</p>
                <p className="text-zinc-400 text-[11px]">{weatherData.temperature_c}°C · {weatherData.condition}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Occasion */}
        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-600">{t.occasion}</p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((occ) => (
              <button
                key={occ.id}
                onClick={() => setSelectedOccasion(occ.id)}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all duration-200 border ${
                  selectedOccasion === occ.id
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >
                <span>{occ.icon}</span>
                {isAr ? occ.labelAr : occ.label}
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => void handleSuggestOutfit()}
          disabled={suggestionLoading || rawClosetItems.length === 0}
          className="w-full h-12 bg-white hover:bg-zinc-100 text-black rounded-2xl text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {suggestionLoading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin" />
              {t.findingOutfit}
            </>
          ) : (
            <>✨ {rawClosetItems.length === 0 ? t.emptySuggest : t.findOutfit}</>
          )}
        </button>

        {suggestionError ? (
          <p className="text-[10px] text-red-400 text-center">{suggestionError}</p>
        ) : null}

        {/* Suggestion result */}
        {outfitSuggestion ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-300">{outfitSuggestion.outfit_name || t.todaysLook}</p>
              <button
                onClick={() => router.push(`/outfit-builder?preselect=${outfitSuggestion.selected_items.map((i) => i.id).join(',')}`)}
                className="text-[9px] uppercase tracking-widest text-zinc-500 hover:text-white transition-colors flex-shrink-0"
              >
                {isAr ? 'فتح في المنسق ←' : 'Open in Builder →'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {outfitSuggestion.selected_items.map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-700">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.item_name || ''} className="w-full h-full object-contain p-1" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-[9px]">—</div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-[7px] uppercase tracking-widest text-zinc-400">{item.category}</p>
                    </div>
                  </div>
                  <p className="text-[8px] text-zinc-400 truncate">{item.item_name}</p>
                  {item.reason ? (
                    <p className="text-[8px] text-zinc-700 leading-tight line-clamp-2">{item.reason}</p>
                  ) : null}
                </div>
              ))}
            </div>
            {outfitSuggestion.ai_verdict ? (
              <div className="px-4 py-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <p className="text-[11px] text-zinc-300 leading-relaxed">{outfitSuggestion.ai_verdict}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  const renderPersonalSection = () => (
    <div className="space-y-4">
      {/* Sub-tab toggle: My Wardrobe / Dress for Today */}
      <div className="flex gap-1 p-1 bg-zinc-900/60 rounded-2xl border border-zinc-800">
        <button
          onClick={() => setPersonalView('wardrobe')}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${personalView === 'wardrobe' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          {t.myWardrobe}
        </button>
        <button
          onClick={() => { setPersonalView('dress-today'); setSelectMode(false); setSelectedItemIds(new Set()) }}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${personalView === 'dress-today' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          {t.dressToday}
        </button>
      </div>
      {personalView === 'wardrobe' ? renderWardrobeView() : renderDressForTodayView()}
    </div>
  )

  const renderPersonalUploadCard = () => {
    const previewUrl = importPreview.mannequinUrl || importPreview.originalUrl
    const isError = importPreview.status === 'error'
    const statusText = importPreview.message || t.uploadHint

    return (
      <div key="personal-outfit-upload" className="group">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importBusy || userLoading || loading}
          aria-label={t.uploadOutfit}
          className="relative w-full aspect-[3/4] overflow-hidden rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/70 transition-all duration-500 hover:border-zinc-500 hover:bg-zinc-900/80 disabled:cursor-wait disabled:opacity-80"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-35" aria-hidden="true" />
          ) : null}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(0,0,0,0.72)_62%)]" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-300 ${isError ? 'border-red-400/50 bg-red-500/10 text-red-200' : 'border-white/20 bg-white/5 text-white group-hover:border-white/45 group-hover:bg-white group-hover:text-black'}`}>
              {importBusy ? (
                <span className="h-5 w-5 rounded-full border border-current/25 border-t-current animate-spin" />
              ) : (
                <span className="text-4xl font-light leading-none">+</span>
              )}
            </span>
            <span className={`max-w-full text-[9px] font-semibold uppercase leading-relaxed tracking-[0.24em] ${isError ? 'text-red-200' : 'text-zinc-300'}`}>
              {importBusy ? statusText : t.uploadOutfit}
            </span>
          </div>
        </button>
        <div className="mt-2">
          <p className={`truncate text-[9px] uppercase tracking-[0.22em] transition-colors ${isError ? 'text-red-300' : 'text-zinc-700 group-hover:text-zinc-500'}`}>{t.uploadOutfit}</p>
          <p className={`mt-1 line-clamp-2 text-[9px] leading-snug ${isError ? 'text-red-400/80' : 'text-zinc-800'}`}>{statusText}</p>
        </div>
      </div>
    )
  }

  const renderClosetGrid = (items: ClosetOutfit[], options?: { leadingTile?: ReactNode }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      {options?.leadingTile}
      {items.map((outfit, index) => {
        const label = outfit.style_category || outfit.outfit_name || outfit.style || (isAr ? 'إطلالة' : 'Outfit')
        const hexes = Array.isArray(outfit.hex_colors)
          ? outfit.hex_colors
          : Array.isArray(outfit.key_colors)
            ? outfit.key_colors
            : []
        const pieces = [outfit.top_wear, outfit.bottom_wear, outfit.shoes].filter(Boolean)
        const hasData = !outfit.image_url && (label || hexes.length > 0 || pieces.length > 0)
        const isPersonalOutfit = closetSectionForSource(outfit._closetSource) === 'personal'
        const outfitSection = closetSectionForSource(outfit._closetSource)
        const sourceLabel = sourceLabelForOutfit(outfit)

        return (
          <div
            key={String(outfit.id || index)}
            className="group cursor-pointer"
            onClick={() => {
              if (String(outfit.id).startsWith('item_')) {
                const itemId = String(outfit.id).replace('item_', '')
                router.push(`/outfit-builder?preselect=${itemId}`)
              } else {
                router.push(`/outfit/${outfit.id}?closetSection=${outfitSection}`)
              }
            }}
          >
            <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/40 group-hover:border-zinc-600 transition-all duration-500">
              {outfit.image_url ? (
                <>
                  <ClosetImage outfit={outfit} label={label} />
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-[9px] uppercase tracking-widest text-zinc-300 truncate">{tr(label)}</p>
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
                    <p className="text-[10px] text-white font-light leading-tight line-clamp-2">{tr(label)}</p>
                    {pieces.map((piece, pieceIndex) => (
                      <p key={`${piece}-${pieceIndex}`} className="text-[9px] text-zinc-600 leading-snug truncate">{tr(String(piece))}</p>
                    ))}
                  </div>
                  <p className="text-[8px] uppercase tracking-[0.3em] text-zinc-800">
                    {sourceLabel}
                  </p>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-800 text-[9px] uppercase tracking-widest">
                  {t.noImage}
                </div>
              )}

              {isPersonalOutfit ? (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    router.push(`/feed?q=${encodeURIComponent(buildFromOutfitPrompt(outfit))}`)
                  }}
                  className={`absolute ${isAr ? 'left-2.5' : 'right-2.5'} top-2.5 rounded-full bg-white px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-black opacity-0 shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition-all duration-300 hover:bg-zinc-200 group-hover:opacity-100`}
                  aria-label={t.buildFromThis}
                >
                  {t.buildFromThis}
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[9px] uppercase tracking-[0.22em] text-zinc-700 group-hover:text-zinc-500 transition-colors">{tr(label)}</p>
                {activeSection === 'all' ? (
                  <p className="mt-1 truncate text-[8px] uppercase tracking-[0.18em] text-zinc-800">{sourceLabel}</p>
                ) : null}
              </div>
              {isPersonalOutfit ? (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    router.push(`/feed?q=${encodeURIComponent(buildFromOutfitPrompt(outfit))}`)
                  }}
                  className="shrink-0 text-[8px] uppercase tracking-[0.18em] text-zinc-500 hover:text-white transition-colors"
                >
                  {t.buildFromThis}
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <ParticleCanvas />

      <div className="relative z-20 flex items-center justify-between px-5 pt-8 sm:pt-10 pb-3">
        <button
          onClick={() => router.back()}
          className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors min-h-[44px] flex items-center"
          aria-label={t.back}
        >
          {isAr ? `${t.back} →` : `← ${t.back}`}
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.4em] text-zinc-500 uppercase">
          {t.closet}
        </h1>
        <div className="w-10" />
      </div>

      <div className="relative z-20 px-4 space-y-2 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          <span className="flex-shrink-0 text-[9px] uppercase tracking-widest text-zinc-700 self-center pr-1">{t.style}</span>
          {LIFESTYLE.map((lifestyle) => (
            <button
              key={lifestyle.id}
              onClick={() => setActiveLifestyles((previous) => previous.includes(lifestyle.id) ? previous.filter((value) => value !== lifestyle.id) : [...previous, lifestyle.id])}
              className={`${pillBase} ${activeLifestyles.includes(lifestyle.id) ? pillOn : pillOff}`}
            >
              {tr(lifestyle.label)}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          <span className="flex-shrink-0 text-[9px] uppercase tracking-widest text-zinc-700 self-center pr-1">{t.color}</span>
          {AESTHETICS.map((aesthetic) => (
            <button
              key={aesthetic.id}
              onClick={() => setActiveAesthetics((previous) => previous.includes(aesthetic.id) ? previous.filter((value) => value !== aesthetic.id) : [...previous, aesthetic.id])}
              className={`${pillBase} ${activeAesthetics.includes(aesthetic.id) ? pillOn : pillOff}`}
            >
              {tr(aesthetic.label)}
              {userPalette.includes(aesthetic.id) ? <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block" /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-20 px-4 pb-4 space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleOutfitPhotoImport(event.target.files?.[0])}
        />

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t.search}
            aria-label="Search saved outfits"
            className={`w-full bg-zinc-900/80 border border-zinc-800 text-white placeholder-zinc-700 text-sm rounded-2xl py-3 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all ${isAr ? 'pr-5 pl-10 text-right' : 'pl-5 pr-10'}`}
            dir={isAr ? 'rtl' : 'ltr'}
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
              aria-label={t.clearSearch}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {closetSectionList.map((section) => {
            const isActive = activeSection === section.id

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                aria-pressed={isActive}
                aria-label={`${section.label}: ${section.count}`}
                className={`min-h-[58px] rounded-xl border px-3 py-2 transition-all duration-300 ${isAr ? 'text-right' : 'text-left'} ${isActive ? 'border-white bg-white text-black shadow-[0_16px_44px_rgba(255,255,255,0.08)]' : 'border-zinc-800 bg-zinc-950/55 text-zinc-500 hover:border-zinc-600 hover:text-zinc-200'}`}
              >
                <span className="block text-[8px] font-bold uppercase leading-snug tracking-[0.22em]">{section.label}</span>
                <span className={`mt-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-2 text-[9px] font-semibold ${isActive ? 'bg-black/10 text-black' : 'bg-zinc-900 text-zinc-600'}`}>
                  {section.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative z-10 px-4 pb-32">
        {loading || userLoading ? (
          <div className="py-32">
            <LoadingSpinner text={t.loading} />
          </div>
        ) : error || authError ? (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-red-400 text-[11px] text-center">{error || authError}</p>
          </div>
        ) : displayed.length === 0 && activeSection !== 'personal' ? (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-zinc-800 text-[10px] uppercase tracking-[0.4em]">
              {hasActiveFilters ? t.emptySearch : t.emptySaved}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-zinc-700 text-[9px] uppercase tracking-widest mb-4">
              {activeSectionMeta.count} {isAr ? 'إطلالة' : `look${activeSectionMeta.count !== 1 ? 's' : ''}`}
              {(activeLifestyles.length > 0 || activeAesthetics.length > 0) ? ` · ${t.filtered}` : ''}
              {userPalette.length > 0 && activeAesthetics.length === 0 ? ` · ${t.sorted}` : ''}
            </p>

            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[10px] uppercase tracking-[0.32em] text-zinc-300">{activeSectionMeta.label}</h2>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-700">{activeSectionMeta.description}</p>
                </div>
                <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-700">{activeSectionMeta.count}</span>
              </div>

              {activeSection === 'personal' ? (
                renderPersonalSection()
              ) : activeSectionOutfits.length > 0 ? (
                renderClosetGrid(activeSectionOutfits)
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-900 px-4 py-8 text-center">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-800">{hasActiveFilters ? t.emptySearch : activeSectionMeta.empty}</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
