type Language = 'en' | 'ar'

type CatalogOutfit = Record<string, unknown>

type ProfileLike = {
  gender?: unknown
  skin_tone?: unknown
  body_shape?: unknown
  height_category?: unknown
  preferred_palette?: unknown
  style_preference?: unknown
}

type WeatherLike = {
  city?: unknown
  temperature_c?: unknown
  condition?: unknown
}

type GeneratedVariant = {
  outfit_name: string
  style: string
  occasions: string
  when_to_wear: string
  color_scheme: string
  key_colors: string[]
  top_wear: string
  bottom_wear: string
  shoes: string
  accessories: string | null
  outerwear: string | null
  material_top: string
  material_bottom: string
  material_shoes: string
  outfit_details: string
  skin_tone_match: boolean
  skin_tone_analysis: string
  pro_tip: string
  alternative: null
  gender?: string
}

type AiStylistPiece = {
  item: string | null
  brand: string | null
  products?: unknown[]
}

type AiStylistOutfit = {
  outfit_name: string
  style: string
  occasion: string
  vibe: string
  ease: 'Easy' | 'Moderate' | 'Statement'
  budget: 'Affordable' | 'Mid-range' | 'Investment'
  color_scheme: string
  pieces: {
    top: AiStylistPiece
    bottom: AiStylistPiece
    shoes: AiStylistPiece
    outerwear: AiStylistPiece | null
    accessories: AiStylistPiece
  }
  how_to_wear: string[]
  why_it_works: string
  styling_tip: string
  key_colors: string[]
}

const COLOR_GROUPS: Record<string, string[]> = {
  black: ['black', 'charcoal', 'dark', 'onyx'],
  white: ['white', 'ivory', 'cream', 'ecru', 'off-white'],
  navy: ['navy', 'blue', 'indigo', 'denim'],
  brown: ['brown', 'tan', 'camel', 'khaki', 'beige', 'chocolate', 'sand'],
  green: ['green', 'olive', 'forest', 'sage', 'emerald'],
  red: ['red', 'burgundy', 'wine', 'maroon'],
  grey: ['grey', 'gray', 'charcoal', 'slate'],
  pink: ['pink', 'rose', 'blush', 'coral'],
}

const OCCASION_TERMS = [
  'office', 'work', 'meeting', 'formal', 'wedding', 'date', 'dinner', 'night',
  'travel', 'weekend', 'casual', 'eid', 'ramadan', 'majlis', 'summer', 'winter',
]

const GARMENT_TERMS = [
  'shirt', 'tee', 'polo', 'blouse', 'jacket', 'blazer', 'coat', 'suit', 'thobe',
  'abaya', 'pants', 'trousers', 'chinos', 'jeans', 'skirt', 'dress', 'sneakers',
  'loafers', 'boots', 'heels', 'sandals', 'watch', 'belt', 'bag',
]

const STYLE_COLORS = {
  light: { colors: ['#1b2a4a', '#800020', '#228b22'], names: 'navy, burgundy, and forest green' },
  medium: { colors: ['#f5f0dc', '#6b7c45', '#b7410e'], names: 'ecru, olive, and rust' },
  tan: { colors: ['#fffff0', '#0047ab', '#800020'], names: 'ivory, cobalt, and burgundy' },
  dark: { colors: ['#f5f5f5', '#50c878', '#d4af37'], names: 'bright white, emerald, and gold' },
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeLanguage(language?: unknown): Language {
  return language === 'ar' ? 'ar' : 'en'
}

function normalizeGender(value?: unknown) {
  const gender = asString(value, 'male').toLowerCase()
  return gender.includes('female') || gender === 'woman' || gender === 'women' ? 'female' : 'male'
}

function normalizedSkinTone(value?: unknown) {
  const skinTone = asString(value, 'medium').toLowerCase()
  if (skinTone.includes('dark') || skinTone.includes('deep')) return 'dark'
  if (skinTone.includes('tan') || skinTone.includes('brown')) return 'tan'
  if (skinTone.includes('light') || skinTone.includes('fair')) return 'light'
  return 'medium'
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1),
  )
}

function outfitBlob(outfit: CatalogOutfit) {
  return [
    outfit.id,
    outfit.outfit_code,
    outfit.style,
    outfit.aesthetic,
    outfit.occasion,
    outfit.occasions,
    outfit.when_to_wear,
    outfit.color_scheme,
    outfit.top,
    outfit.top_wear,
    outfit.bottom,
    outfit.bottom_wear,
    outfit.shoes,
    outfit.accessories,
    outfit.outerwear,
    outfit.outfit_details,
    outfit.pieces,
    outfit.colors,
    outfit.hex_colors,
  ]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function expandedQueryTerms(query: string) {
  const terms = tokenSet(query)
  for (const [color, variants] of Object.entries(COLOR_GROUPS)) {
    if (terms.has(color) || variants.some((variant) => terms.has(variant))) {
      variants.forEach((variant) => terms.add(variant))
    }
  }
  return Array.from(terms)
}

function scoreCatalogOutfit(outfit: CatalogOutfit, query: string, skinTone: string, bodyShape: string) {
  const blob = outfitBlob(outfit)
  const terms = expandedQueryTerms(query)
  let score = 0

  for (const term of terms) {
    if (blob.includes(term)) score += 6
  }

  for (const term of OCCASION_TERMS) {
    if (query.toLowerCase().includes(term) && blob.includes(term)) score += 8
  }

  for (const term of GARMENT_TERMS) {
    if (query.toLowerCase().includes(term) && blob.includes(term)) score += 10
  }

  const palette = STYLE_COLORS[normalizedSkinTone(skinTone) as keyof typeof STYLE_COLORS]
  for (const colorName of palette.names.split(', ')) {
    if (blob.includes(colorName.replace('and ', ''))) score += 2
  }

  const body = bodyShape.toLowerCase()
  if ((body.includes('stocky') || body.includes('heavy')) && /straight|structured|dark|vertical|monochrome/.test(blob)) score += 4
  if (body.includes('slim') && /layer|relaxed|structured|chunky|wide/.test(blob)) score += 4
  if (body.includes('athletic') && /straight|tailored|structured|tapered/.test(blob)) score += 4

  if (asString(outfit.image_url)) score += 2
  return score
}

function outfitLabel(outfit: CatalogOutfit) {
  return asString(outfit.style)
    || asString(outfit.aesthetic)
    || asString(outfit.outfit_name)
    || asString(outfit.outfit_code)
    || 'this look'
}

export function buildLocalCurationResponse({
  query,
  outfits,
  gender,
  skinTone,
  bodyShape,
  language,
}: {
  query: string
  outfits: CatalogOutfit[]
  gender?: string
  skinTone?: string
  bodyShape?: string
  language?: unknown
}) {
  const lang = normalizeLanguage(language)
  const ranked = outfits
    .filter((outfit) => asString(outfit.image_url))
    .map((outfit) => ({ outfit, score: scoreCatalogOutfit(outfit, query, skinTone || '', bodyShape || '') }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  const suggestions = ranked
    .filter(({ score }, index) => score > 0 || index < 4)
    .map(({ outfit }) => ({
      outfit_id: String(outfit.id || ''),
      reason: lang === 'ar'
        ? `هذه الإطلالة تناسب طلبك لأنها تجمع بين ${outfitLabel(outfit)} ولوحة ألوان عملية لشكل الجسم والبشرة.`
        : `This answers the brief with ${outfitLabel(outfit)} pieces and a palette that works for your ${skinTone || 'profile'}.`,
    }))
    .filter((suggestion) => suggestion.outfit_id)

  return {
    mode: 'curation',
    intent: query.slice(0, 48),
    response: lang === 'ar'
      ? suggestions.length
        ? 'اخترت لك أقرب الإطلالات من الأرشيف، ووازنتها حسب المناسبة واللون والشكل.'
        : 'سأبني لك إطلالة مخصصة لأن الأرشيف لا يحتوي على تطابق قوي.'
      : suggestions.length
        ? `I pulled the strongest ${gender || 'style'} matches from your archive and ranked them for the brief.`
        : "Nothing in the archive is exact enough, so I'll build this fresh for you.",
    suggestions,
    vibe: lang === 'ar' ? 'منسق بذكاء' : 'Styled fallback',
    provider: 'local-stylist',
  }
}

export function buildLocalAdviceResponse({
  query,
  name,
  skinTone,
  bodyShape,
  language,
}: {
  query: string
  name?: string
  skinTone?: string
  bodyShape?: string
  language?: unknown
}) {
  const lang = normalizeLanguage(language)
  const palette = STYLE_COLORS[normalizedSkinTone(skinTone) as keyof typeof STYLE_COLORS]
  const firstName = asString(name, lang === 'ar' ? 'صديقي' : 'there').split(' ')[0]
  const shape = asString(bodyShape, 'balanced')

  return {
    mode: 'advice',
    intent: query,
    response: lang === 'ar'
      ? `أقوى نقطة لك الآن هي اختيار ألوان ترفع التباين حول الوجه: ${palette.names}. مع شكل جسم ${shape.replace(/_/g, ' ')}، ركز على قصة واضحة: كتف مضبوط، خصر غير مزدحم، وحذاء نظيف يثبت الإطلالة. ابدأ بقطعة أساسية من Uniqlo أو COS ثم أضف قطعة أكثر حدة من Zara أو Mango.`
      : `The strongest move is to keep the palette intentional: ${palette.names} will flatter your skin tone without making the outfit feel loud, ${firstName}. For a ${shape.replace(/_/g, ' ')} build, prioritize clean shoulder structure, trousers that fall straight, and one polished shoe. Start with dependable basics from Uniqlo or COS, then sharpen the outfit with Zara, Mango, or Reiss.`,
    colors: palette.colors.map((hex, index) => ({ hex, name: palette.names.split(', ')[index]?.replace('and ', '') || 'Accent' })),
    suggestions: [],
    vibe: '',
    provider: 'local-stylist',
  }
}

export function buildLocalGeneratedOutfit({
  query,
  gender,
  skinTone,
  bodyShape,
  stylePref,
  language,
  weather,
}: {
  query: string
  gender?: string
  skinTone?: string
  bodyShape?: string
  stylePref?: string
  language?: unknown
  weather?: WeatherLike
}): GeneratedVariant {
  const lang = normalizeLanguage(language)
  const resolvedGender = normalizeGender(gender)
  const tone = normalizedSkinTone(skinTone)
  const palette = STYLE_COLORS[tone as keyof typeof STYLE_COLORS]
  const q = query.toLowerCase()
  const isFormal = /formal|office|work|meeting|wedding|majlis|eid/.test(q)
  const isHot = Number(weather?.temperature_c) >= 28 || /summer|hot|beach/.test(q)
  const body = asString(bodyShape, 'balanced').replace(/_/g, ' ')

  const top = resolvedGender === 'female'
    ? isFormal ? 'Ivory satin blouse with a clean neckline' : isHot ? 'White linen relaxed shirt' : 'Fine-knit cream top'
    : isFormal ? 'Crisp white Oxford shirt' : isHot ? 'Open-collar ivory linen shirt' : 'Navy merino knit polo'
  const bottom = resolvedGender === 'female'
    ? isFormal ? 'High-waist tailored wide-leg trousers' : 'Straight-leg dark denim or tailored linen trouser'
    : isFormal ? 'Charcoal straight-leg tailored trousers' : 'Stone straight-leg chinos'
  const shoes = isFormal ? 'Polished black leather loafers' : 'Clean white leather sneakers'
  const outerwear = isFormal && !isHot ? 'Structured navy blazer' : null
  const accessories = resolvedGender === 'female' ? 'Small gold hoops and a structured mini bag' : 'Slim leather belt and silver watch'

  return {
    outfit_name: lang === 'ar' ? 'تنسيق واثق' : 'Confident Edit',
    style: isFormal ? 'Smart Casual' : asString(stylePref, 'Clean Minimal'),
    occasions: isFormal ? 'Office; Dinner; Smart event' : 'Everyday; Weekend; Travel',
    when_to_wear: isHot ? 'Warm weather and bright daytime plans' : 'Year-round polished dressing',
    color_scheme: `A flattering ${palette.names} palette anchored with clean neutrals.`,
    key_colors: palette.colors,
    top_wear: top,
    bottom_wear: bottom,
    shoes,
    accessories,
    outerwear,
    material_top: isHot ? 'Linen or breathable cotton' : 'Cotton or merino knit',
    material_bottom: isHot ? 'Lightweight cotton twill' : 'Wool-blend or cotton twill',
    material_shoes: 'Leather',
    outfit_details: `Built for ${query}. The straight lines and controlled contrast work well for a ${body} build while the palette flatters ${tone} skin.`,
    skin_tone_match: true,
    skin_tone_analysis: `The palette uses ${palette.names}, which gives ${tone} skin clean contrast without overpowering it.`,
    pro_tip: isFormal ? 'Keep the shirt tucked cleanly and let the blazer create the shoulder line.' : 'Repeat one color from the top in the accessory or shoe detail to make it feel intentional.',
    alternative: null,
    gender: resolvedGender,
  }
}

function buildAiPieces(outfit: GeneratedVariant): AiStylistOutfit['pieces'] {
  return {
    top: { item: outfit.top_wear, brand: 'Uniqlo' },
    bottom: { item: outfit.bottom_wear, brand: 'COS' },
    shoes: { item: outfit.shoes, brand: outfit.shoes.toLowerCase().includes('sneaker') ? 'Adidas' : 'Mango' },
    outerwear: outfit.outerwear ? { item: outfit.outerwear, brand: 'Zara' } : null,
    accessories: { item: outfit.accessories, brand: null },
  }
}

export function buildLocalAiStylistOutfits({
  profile,
  occasion,
  mood,
  season,
  language,
  weather,
}: {
  profile?: ProfileLike | null
  occasion?: string
  mood?: string
  season?: string
  language?: unknown
  weather?: WeatherLike
}): AiStylistOutfit[] {
  const gender = normalizeGender(profile?.gender)
  const skinTone = asString(profile?.skin_tone, 'medium')
  const bodyShape = asString(profile?.body_shape, 'average')
  const stylePref = asString(profile?.style_preference, asString(mood, 'Clean Minimal'))
  const baseQuery = [occasion || 'Everyday', mood || stylePref, season || '', asString(weather?.condition)].filter(Boolean).join(' ')
  const primary = buildLocalGeneratedOutfit({ query: baseQuery, gender, skinTone, bodyShape, stylePref, language, weather })
  const second = buildLocalGeneratedOutfit({ query: `${baseQuery} office polished`, gender, skinTone, bodyShape, stylePref: 'Quiet Luxury', language, weather })
  const third = buildLocalGeneratedOutfit({ query: `${baseQuery} weekend relaxed`, gender, skinTone, bodyShape, stylePref: 'Smart Casual', language, weather })

  return [primary, second, third].map((outfit, index) => ({
    outfit_name: index === 0 ? outfit.outfit_name : index === 1 ? 'Polished Reserve' : 'Weekend Reset',
    style: outfit.style,
    occasion: occasion || 'Everyday',
    vibe: index === 0 ? 'clean, sharp, wearable' : index === 1 ? 'quiet, refined, exact' : 'relaxed, modern, easy',
    ease: index === 1 ? 'Moderate' : 'Easy',
    budget: index === 1 ? 'Mid-range' : 'Affordable',
    color_scheme: outfit.color_scheme,
    pieces: buildAiPieces(outfit),
    how_to_wear: [
      'Keep the top cleanly tucked or half-tucked to define the waist.',
      'Let the trouser break lightly on the shoe for a longer line.',
      'Repeat one color in the accessory so the look feels finished.',
    ],
    why_it_works: outfit.outfit_details,
    styling_tip: outfit.pro_tip,
    key_colors: outfit.key_colors,
  }))
}

export function buildVisionUnavailableCopy(language?: unknown, details?: string, question?: string) {
  const lang = normalizeLanguage(language)
  const known = asString(details)
  const asked = asString(question)

  if (lang === 'ar') {
    return asked
      ? `أقدر أساعدك من تفاصيل الإطلالة المتاحة، لكن تحليل الصورة المباشر غير متاح الآن. ${known ? `حسب الظاهر: ${known}. ` : ''}لتحسينها، وحّد لون الحذاء أو الإكسسوار مع لون أساسي في القطعة.`
      : 'تحليل الصورة المباشر غير متاح الآن، لكن أستطيع تنسيق القطعة من التفاصيل التي تم استخراجها.'
  }

  return asked
    ? `I can still help from the outfit details, but direct vision analysis is unavailable right now. ${known ? `From what I have: ${known}. ` : ''}A safe upgrade is to repeat one core color in the shoe or accessory and keep the silhouette clean.`
    : 'Direct vision analysis is unavailable right now, but I can still style the piece from the details already extracted.'
}
