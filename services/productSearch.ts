// ─── Product Search & Scraper ─────────────────────────────────────────────────
// Fetches real products from ASOS's product API (covers 900+ brands).
// Results are cached in Supabase for 24 hours to avoid repeated scraping.
// Fallback: H&M and Uniqlo JSON endpoints for their own-brand items.

import { createClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'

const supabase = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'product search'),
  requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'product search')
)

export interface Product {
  name:      string
  brand:     string
  price:     string
  url:       string
  image_url: string
  gender:    string
  category:  string
}

// ─── Cache helpers ────────────────────────────────────────────────────────────
async function getCached(query: string, gender: string): Promise<Product[] | null> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('scraped_products')
    .select('*')
    .eq('query', query.toLowerCase())
    .eq('gender', gender)
    .gte('scraped_at', cutoff)
    .limit(5)
  return data && data.length > 0 ? (data as Product[]) : null
}

async function saveToCache(products: Product[], query: string, gender: string) {
  if (!products.length) return
  await supabase.from('scraped_products').insert(
    products.map(p => ({ ...p, query: query.toLowerCase(), gender, scraped_at: new Date().toISOString() }))
  )
}

// ─── ASOS product API ─────────────────────────────────────────────────────────
// ASOS carries 900+ brands — Zara, H&M, Nike, Stone Island, Ralph Lauren, etc.
// Their internal search API returns structured JSON with direct product URLs.
async function fetchFromASOS(query: string, gender: string): Promise<Product[]> {
  const genderParam = gender === 'female' ? 'women' : 'men'
  const url =
    `https://www.asos.com/api/product/search/v2/` +
    `?q=${encodeURIComponent(query)}` +
    `&channel=desktop-web&country=US&currency=USD&lang=en-US` +
    `&limit=6&store=US&gender=${genderParam}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), 4000)
  let res: Response
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.asos.com/',
      },
      next: { revalidate: 0 },
    })
  } catch { return [] } finally { clearTimeout(timer) }

  if (!res.ok) return []

  let data: any
  try { data = await res.json() } catch { return [] }
  const items: any[] = data?.products || []

  return items.slice(0, 5).map((item: any) => ({
    name:      item.name || '',
    brand:     item.brandName || 'ASOS',
    price:     item.price?.current?.text || '',
    url:       item.url ? `https://www.asos.com${item.url}` : '',
    image_url: item.imageUrl ? `https://images.asos-media.com/products/${item.imageUrl}` : '',
    gender,
    category:  '',
  })).filter(p => p.url)
}

// ─── H&M product API ──────────────────────────────────────────────────────────
async function fetchFromHM(query: string, gender: string): Promise<Product[]> {
  const dept = gender === 'female' ? 'ladies' : 'men'
  const url =
    `https://www2.hm.com/en_us/search-results.html` +
    `?q=${encodeURIComponent(query)}&department=${dept}_all&sort=RELEVANCE&image-size=small&image-quality=auto&limit=6`

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(new DOMException('Timeout', 'AbortError')), 4000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
        'x-requested-with': 'XMLHttpRequest',
      },
    }).finally(() => clearTimeout(t))
    if (!res.ok) return []
    let html: string
    try { html = await res.text() } catch { return [] }
    // H&M embeds JSON in a script tag: window.__INITIAL_STATE__
    const match = html.match(/"products":\s*(\[[\s\S]*?\])\s*,\s*"productListFilter"/)
    if (!match) return []
    const productJson = match[1]
    if (!productJson) return []

    let products: any[]
    try { products = JSON.parse(productJson) } catch { return [] }
    return products.slice(0, 5).map((p: any) => ({
      name:      p.name || '',
      brand:     'H&M',
      price:     p.price?.value ? `$${p.price.value}` : '',
      url:       p.link ? `https://www2.hm.com${p.link}` : '',
      image_url: p.images?.[0]?.url || '',
      gender,
      category:  '',
    })).filter((p: Product) => p.url)
  } catch { return [] }
}

// ─── Uniqlo product API ───────────────────────────────────────────────────────
async function fetchFromUniqlo(query: string, gender: string): Promise<Product[]> {
  const genderParam = gender === 'female' ? 'Women' : 'Men'
  const url =
    `https://www.uniqlo.com/us/api/commerce/v5/en/products?` +
    `q=${encodeURIComponent(query)}&prefn1=gender&prefv1=${genderParam}&limit=6`

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(new DOMException('Timeout', 'AbortError')), 4000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    }).finally(() => clearTimeout(t))
    if (!res.ok) return []
    let data: any
    try { data = await res.json() } catch { return [] }
    const items: any[] = data?.result?.items || data?.items || []
    return items.slice(0, 5).map((item: any) => ({
      name:      item.name || '',
      brand:     'Uniqlo',
      price:     item.prices?.base?.value?.text || '',
      url:       item.productId ? `https://www.uniqlo.com/us/en/products/${item.productId}.html` : '',
      image_url: item.mainPic || '',
      gender,
      category:  '',
    })).filter((p: Product) => p.url)
  } catch { return [] }
}

// ─── Public API ───────────────────────────────────────────────────────────────
// Searches for products matching a query + gender.
// 1. Checks Supabase cache (24h TTL)
// 2. Falls back to ASOS (primary — covers 900+ brands)
// 3. Falls back to H&M, then Uniqlo for their specific items

export async function searchProducts(
  query: string,
  gender: string,
  category?: string
): Promise<Product[]> {
  const cleanedQuery = query
    .replace(/\b(slim-fit|straight-fit|relaxed-fit|fitted|oversized|crew neck|v-neck|round neck|turtleneck|cotton|polyester|merino|cashmere|wool|linen|nylon|suede|leather|ribbed|premium|quality)\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ')

  // 1. Check cache
  const cached = await getCached(cleanedQuery, gender)
  if (cached) return cached

  // 2. Try ASOS first (broadest coverage)
  let products = await fetchFromASOS(cleanedQuery, gender)

  // 3. If ASOS gives nothing, try H&M
  if (!products.length) {
    products = await fetchFromHM(cleanedQuery, gender)
  }

  // 4. If still nothing, try Uniqlo
  if (!products.length) {
    products = await fetchFromUniqlo(cleanedQuery, gender)
  }

  // Tag category and save to cache
  if (products.length) {
    const tagged = products.map(p => ({ ...p, category: category || '' }))
    await saveToCache(tagged, cleanedQuery, gender)
    return tagged
  }

  return []
}

// Search for multiple pieces in parallel
export async function searchOutfitPieces(
  pieces: Record<string, { item: string; brand: string | null }>,
  gender: string
): Promise<Record<string, Product[]>> {
  const entries = Object.entries(pieces).filter(([, v]) => v?.item)

  const results = await Promise.all(
    entries.map(async ([key, piece]) => {
      // Build query: prefer brand-specific search if brand is known
      const query = piece.brand
        ? `${piece.brand} ${piece.item}`
        : piece.item
      const products = await searchProducts(query, gender, key)
      return [key, products] as [string, Product[]]
    })
  )

  return Object.fromEntries(results)
}
