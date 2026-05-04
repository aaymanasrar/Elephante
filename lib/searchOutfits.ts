import type { Outfit } from '@/types/outfit'

const STOP_WORDS = new Set([
  'with', 'and', 'or', 'the', 'a', 'an', 'in', 'for', 'some', 'that', 'this', 'these',
  'those', 'is', 'are', 'want', 'looking', 'like', 'something', 'i', 'me', 'my', 'show',
  'wearing', 'wear', 'have', 'outfit', 'outfits', 'look', 'style', 'can', 'find', 'give',
  'suggest', 'what', 'kind', 'of', 'do', 'you',
])

const COLOR_MAP = {
  blue: ['blue', 'navy', 'cobalt', 'royal', 'sky', 'indigo', 'denim', 'teal'],
  navy: ['navy', 'blue', 'midnight', 'denim'],
  white: ['white', 'cream', 'ivory', 'off-white', 'pearl'],
  black: ['black', 'charcoal', 'onyx', 'ebony'],
  grey: ['grey', 'gray', 'charcoal', 'silver', 'slate', 'ash'],
  gray: ['gray', 'grey', 'charcoal', 'silver', 'slate', 'ash'],
  brown: ['brown', 'tan', 'camel', 'khaki', 'beige', 'earth', 'cognac', 'coffee', 'hazel'],
  beige: ['beige', 'cream', 'tan', 'sand', 'nude', 'ivory', 'camel'],
  khaki: ['khaki', 'tan', 'beige', 'olive', 'army'],
  olive: ['olive', 'green', 'khaki', 'army'],
  green: ['green', 'olive', 'forest', 'sage', 'emerald', 'hunter'],
  red: ['red', 'burgundy', 'wine', 'maroon', 'crimson', 'scarlet'],
  pink: ['pink', 'blush', 'rose', 'salmon', 'coral', 'magenta'],
  yellow: ['yellow', 'mustard', 'gold', 'amber', 'honey'],
  orange: ['orange', 'rust', 'terracotta', 'burnt', 'copper'],
  purple: ['purple', 'lavender', 'violet', 'plum', 'mauve', 'lilac'],
  gold: ['gold', 'amber', 'champagne', 'yellow'],
  camel: ['camel', 'tan', 'beige', 'brown', 'cream'],
  neutral: ['neutral', 'beige', 'cream', 'off-white', 'sand'],
  dark: ['dark', 'black', 'charcoal', 'navy', 'midnight'],
  light: ['light', 'white', 'cream', 'pastel', 'soft'],
} as const

const GARMENT_MAP = {
  shirt: ['shirt', 'polo', 'button', 'blouse', 'oxford', 'ocbd', 'dress shirt', 'top', 'tee'],
  polo: ['polo', 'shirt', 'top'],
  tshirt: ['tee', 't-shirt', 'crew', 'casual top', 'shirt'],
  tee: ['tee', 't-shirt', 'shirt', 'crew', 'casual'],
  blouse: ['blouse', 'shirt', 'top'],
  top: ['top', 'shirt', 'polo', 'blouse', 'tee', 'crop'],
  sweater: ['sweater', 'knit', 'pullover', 'jumper', 'knitwear'],
  hoodie: ['hoodie', 'sweatshirt', 'pullover', 'casual'],
  pants: ['pant', 'trouser', 'chino', 'slack', 'jean', 'denim', 'cargo', 'short', 'bottom'],
  trousers: ['trouser', 'pant', 'chino', 'slack', 'formal', 'bottom'],
  chinos: ['chino', 'pant', 'trouser', 'khaki', 'bottom'],
  jeans: ['jean', 'denim', 'bottom', 'pant'],
  shorts: ['short', 'pant', 'casual', 'bottom'],
  skirt: ['skirt', 'bottom', 'dress'],
  shoes: ['shoe', 'sneaker', 'loafer', 'oxford', 'boot', 'sandal', 'trainer', 'slipper', 'footwear', 'leather shoe'],
  sneakers: ['sneaker', 'trainer', 'runner', 'shoe', 'casual shoe'],
  boots: ['boot', 'shoe'],
  loafers: ['loafer', 'moccasin', 'shoe'],
  sandals: ['sandal', 'slipper', 'shoe', 'footwear'],
  oxfords: ['oxford', 'brogue', 'leather shoe', 'shoe'],
  heels: ['heel', 'pump', 'stiletto', 'shoe'],
  jacket: ['jacket', 'blazer', 'coat', 'outerwear', 'outer'],
  blazer: ['blazer', 'jacket', 'suit', 'formal'],
  coat: ['coat', 'jacket', 'outerwear', 'overcoat'],
  suit: ['suit', 'blazer', 'formal', 'tuxedo'],
  dress: ['dress', 'gown', 'formal'],
  thobe: ['thobe', 'thob', 'dishdasha', 'traditional', 'arabic', 'gulf', 'saudi'],
  ghutra: ['ghutra', 'shemagh', 'keffiyeh', 'agal', 'traditional', 'headwear'],
  abaya: ['abaya', 'traditional', 'islamic', 'modest'],
  accessory: ['watch', 'belt', 'bag', 'jewel', 'jewelry', 'scarf', 'tie', 'cufflink', 'accessory'],
  watch: ['watch', 'wrist', 'timepiece'],
  belt: ['belt', 'leather'],
  tie: ['tie', 'necktie', 'cravat', 'bow tie'],
  bag: ['bag', 'tote', 'clutch', 'handbag', 'purse'],
} as const

const STYLE_MAP = {
  casual: ['casual', 'relaxed', 'everyday', 'weekend', 'leisure'],
  formal: ['formal', 'black tie', 'gala', 'elegant', 'evening'],
  business: ['business', 'corporate', 'office', 'work', 'professional', 'meeting', 'client'],
  smart: ['smart', 'polished', 'smart casual', 'business casual'],
  office: ['office', 'work', 'business', 'corporate', 'professional'],
  wedding: ['wedding', 'formal', 'gala', 'ceremony', 'celebration'],
  traditional: ['traditional', 'thobe', 'arabic', 'gulf', 'saudi', 'cultural', 'heritage'],
  streetwear: ['street', 'urban', 'casual', 'hypebeast', 'modern'],
  sporty: ['sport', 'athletic', 'gym', 'workout', 'active', 'running'],
  date: ['date', 'dinner', 'evening', 'romantic'],
  travel: ['travel', 'airport', 'commute', 'transit'],
  beach: ['beach', 'resort', 'summer', 'poolside', 'coastal'],
} as const

const SEASON_MAP = {
  winter: ['winter', 'cold', 'autumn', 'fall', 'warm'],
  summer: ['summer', 'warm', 'hot', 'spring', 'tropical', 'beach', 'resort'],
  spring: ['spring', 'summer', 'warm climate', 'year-round'],
  autumn: ['autumn', 'fall', 'winter', 'cold'],
  fall: ['fall', 'autumn', 'winter', 'cool'],
  hot: ['summer', 'warm', 'hot', 'tropical'],
  cold: ['winter', 'autumn', 'cold', 'warm'],
  seasonal: ['spring', 'summer', 'autumn', 'winter', 'year-round'],
  'year-round': ['year-round', 'all season', 'versatile'],
  anytime: ['year-round', 'all season', 'versatile'],
} as const

function buildBlob(item: Outfit) {
  return [
    item.style,
    item.style_category,
    item.occasion,
    item.when_to_wear,
    item.aesthetic,
    item.top,
    item.outfit_code,
    item.outfit_name,
    item.color_scheme,
    Array.isArray(item.colors) ? item.colors.join(' ') : item.colors,
    Array.isArray(item.pieces) ? item.pieces.join(' ') : item.pieces,
    item.top_wear,
    item.bottom_wear,
    item.shoes,
    item.accessories,
    item.outerwear,
    item.material_notes,
    item.outfit_details,
    item.brand,
    item.occasions,
  ].filter(Boolean).join(' ').toLowerCase()
}

function expandToken(token: string) {
  const seen = new Set<string>([token])
  const add = (values: readonly string[]) => values.forEach((value) => seen.add(value))

  if (token in COLOR_MAP) add(COLOR_MAP[token as keyof typeof COLOR_MAP])
  if (token in GARMENT_MAP) add(GARMENT_MAP[token as keyof typeof GARMENT_MAP])
  if (token in STYLE_MAP) add(STYLE_MAP[token as keyof typeof STYLE_MAP])
  if (token in SEASON_MAP) add(SEASON_MAP[token as keyof typeof SEASON_MAP])

  return Array.from(seen)
}

export function matchesOutfitSearch(query: string, outfit: Outfit) {
  const blob = buildBlob(outfit)
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))

  if (tokens.length === 0) return true

  return tokens.every((token) => {
    const variants = expandToken(token)
    return variants.some((variant) => blob.includes(variant))
  })
}

export function searchOutfits(outfits: Outfit[], searchQuery: string) {
  return outfits.filter((outfit) => matchesOutfitSearch(searchQuery, outfit))
}
