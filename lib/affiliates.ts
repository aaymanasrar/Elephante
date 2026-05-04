// ─── Official Brand Search URLs — Gender-filtered ────────────────────────────

export type Gender = 'male' | 'female'

// Strip fabric/fit jargon so the search query actually returns results
function cleanQuery(item: string): string {
  return item
    .replace(/\b(slim-fit|straight-fit|relaxed-fit|wide-leg|tapered|fitted|oversized|cropped|high-waist|low-rise|mid-rise|regular-fit|classic-fit)\b/gi, '')
    .replace(/\b(cotton|polyester|merino|cashmere|wool|linen|nylon|suede|leather|velvet|corduroy|ribbed|woven|knit|knitted|jersey|tweed|satin|silk|fleece|sherpa)\b/gi, '')
    .replace(/\b(supima|pima|premium|quality|fine|soft|lightweight|heavyweight|breathable)\b/gi, '')
    .replace(/\b(crew neck|v-neck|round neck|turtleneck|mock neck|polo neck)\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
}

// Brand → gender-aware search URL
const BRAND_SEARCH: Record<string, (q: string, g: Gender) => string> = {
  'Zara': (q, g) =>
    g === 'male'
      ? `https://www.zara.com/us/en/search?searchTerm=${q}&section=MAN`
      : `https://www.zara.com/us/en/search?searchTerm=${q}&section=WOMAN`,

  'H&M': (q, g) =>
    g === 'male'
      ? `https://www2.hm.com/en_us/men/search-results.html?q=${q}`
      : `https://www2.hm.com/en_us/women/search-results.html?q=${q}`,

  'Uniqlo': (q, g) =>
    `https://www.uniqlo.com/us/en/search?q=${q}&prefn1=gender&prefv1=${g === 'male' ? 'Men' : 'Women'}`,

  'COS': (q, g) =>
    g === 'male'
      ? `https://www.cos.com/en_gbp/men/search/${q}.html`
      : `https://www.cos.com/en_gbp/women/search/${q}.html`,

  'Arket': (q, g) =>
    g === 'male'
      ? `https://www.arket.com/en_gbp/search?q=${q}&department=men`
      : `https://www.arket.com/en_gbp/search?q=${q}&department=women`,

  'Mango': (q, g) =>
    g === 'male'
      ? `https://shop.mango.com/us/men/search?q=${q}`
      : `https://shop.mango.com/us/women/search?q=${q}`,

  'ASOS': (q, g) =>
    g === 'male'
      ? `https://www.asos.com/men/search/?q=${q}`
      : `https://www.asos.com/women/search/?q=${q}`,

  'River Island': (q, g) =>
    g === 'male'
      ? `https://www.riverisland.com/men/search?q=${q}`
      : `https://www.riverisland.com/women/search?q=${q}`,

  'Pull&Bear': (q, g) =>
    g === 'male'
      ? `https://www.pullandbear.com/us/en/man/search?searchTerm=${q}`
      : `https://www.pullandbear.com/us/en/woman/search?searchTerm=${q}`,

  'Bershka': (q, g) =>
    g === 'male'
      ? `https://www.bershka.com/us/en/man/search?searchTerm=${q}`
      : `https://www.bershka.com/us/en/woman/search?searchTerm=${q}`,

  'Reiss': (q, g) =>
    g === 'male'
      ? `https://www.reiss.com/mens/search/?q=${q}`
      : `https://www.reiss.com/womens/search/?q=${q}`,

  'Ted Baker': (q, g) =>
    g === 'male'
      ? `https://www.tedbaker.com/us/mens/search?q=${q}`
      : `https://www.tedbaker.com/us/womens/search?q=${q}`,

  'Ralph Lauren': (q, g) =>
    g === 'male'
      ? `https://www.ralphlauren.com/mens-search?q=${q}`
      : `https://www.ralphlauren.com/womens-search?q=${q}`,

  'Tommy Hilfiger': (q, g) =>
    g === 'male'
      ? `https://www.tommy.com/en/search?q=${q}&category=men`
      : `https://www.tommy.com/en/search?q=${q}&category=women`,

  'Lacoste': (q, g) =>
    g === 'male'
      ? `https://www.lacoste.com/us/lacoste/man/catalogsearch/result/?q=${q}`
      : `https://www.lacoste.com/us/lacoste/woman/catalogsearch/result/?q=${q}`,

  "Levi's": (q) =>
    `https://www.levi.com/US/en_US/search?q=${q}`,

  'Nike': (q, g) =>
    g === 'male'
      ? `https://www.nike.com/search?q=${q}&gender=men`
      : `https://www.nike.com/search?q=${q}&gender=women`,

  'Adidas': (q, g) =>
    g === 'male'
      ? `https://www.adidas.com/us/search?q=${q}&gender=men`
      : `https://www.adidas.com/us/search?q=${q}&gender=women`,

  'New Balance': (q, g) =>
    g === 'male'
      ? `https://www.newbalance.com/search?q=${q}&prefn1=gender&prefv1=Men%27s`
      : `https://www.newbalance.com/search?q=${q}&prefn1=gender&prefv1=Women%27s`,

  'Vans': (q, g) =>
    g === 'male'
      ? `https://www.vans.com/en-us/mens-search?q=${q}`
      : `https://www.vans.com/en-us/womens-search?q=${q}`,

  'Converse': (q) =>
    `https://www.converse.com/search?q=${q}`,

  'Timberland': (q, g) =>
    g === 'male'
      ? `https://www.timberland.com/mens/search?q=${q}`
      : `https://www.timberland.com/womens/search?q=${q}`,

  'Dr. Martens': (q, g) =>
    g === 'male'
      ? `https://www.drmartens.com/us/en_us/mens/search?q=${q}`
      : `https://www.drmartens.com/us/en_us/womens/search?q=${q}`,

  'Stone Island': (q) =>
    `https://www.stoneisland.com/en-us/search?q=${q}`,

  'CP Company': (q) =>
    `https://www.cpcompany.com/en-us/search?q=${q}`,

  'Ami Paris': (q, g) =>
    g === 'male'
      ? `https://www.amiparis.com/collections/men?q=${q}`
      : `https://www.amiparis.com/collections/women?q=${q}`,

  'Acne Studios': (q, g) =>
    g === 'male'
      ? `https://www.acnestudios.com/en/man/search?q=${q}`
      : `https://www.acnestudios.com/en/woman/search?q=${q}`,

  'A.P.C': (q, g) =>
    g === 'male'
      ? `https://www.apc.fr/en/catalog/man?q=${q}`
      : `https://www.apc.fr/en/catalog/woman?q=${q}`,

  "Arc'teryx": (q, g) =>
    g === 'male'
      ? `https://arcteryx.com/us/en/c/mens?q=${q}`
      : `https://arcteryx.com/us/en/c/womens?q=${q}`,
}

export interface ShopLink {
  url:   string
  label: string
}

export function getBrandShopLink(
  brand: string | null,
  itemDescription: string,
  gender: Gender = 'male'
): ShopLink | null {
  if (!brand) return null

  const q = encodeURIComponent(cleanQuery(itemDescription))

  // Exact match
  if (BRAND_SEARCH[brand]) {
    return { url: BRAND_SEARCH[brand](q, gender), label: brand }
  }

  // Case-insensitive match
  const key = Object.keys(BRAND_SEARCH).find(
    k => k.toLowerCase() === brand.toLowerCase()
  )
  if (key) {
    const buildUrl = BRAND_SEARCH[key]
    if (buildUrl) {
      return { url: buildUrl(q, gender), label: key }
    }
  }

  // Unknown brand — fall back to ASOS gender section
  const fallback = gender === 'male'
    ? `https://www.asos.com/men/search/?q=${encodeURIComponent(brand + ' ' + cleanQuery(itemDescription))}`
    : `https://www.asos.com/women/search/?q=${encodeURIComponent(brand + ' ' + cleanQuery(itemDescription))}`

  return { url: fallback, label: brand }
}
