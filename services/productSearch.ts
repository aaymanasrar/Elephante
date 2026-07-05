// ─── Product Search & Scraper ─────────────────────────────────────────────────
// Fetches real products from authentic brand websites only (H&M, Uniqlo, etc.).
// Results are cached in Supabase for 6 hours to avoid repeated scraping.
// Fallback: Perplexity Pro Search for live web results from official brand pages.

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'
import { hasPerplexityConfig, parseJSONFromText, runPerplexityProSearch } from '@/services/perplexity'

let _supabase: SupabaseClient | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'product search'),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'product search')
    )
  }
  return _supabase
}

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
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()  // 6h: keep prices near-live
  const { data } = await getSupabase()
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
  await getSupabase().from('scraped_products').insert(
    products.map(p => ({ ...p, query: query.toLowerCase(), gender, scraped_at: new Date().toISOString() }))
  )
}



// ─── Market / region (accurate store links + local prices) ───────────────────
// Set PRODUCT_MARKET in .env.local: e.g. en_us (default), en_gb, ar_ae, de_de
const MARKET = (process.env.PRODUCT_MARKET || 'en_us').toLowerCase()
const COUNTRY = MARKET.split('_')[1] || 'us'
const UNIQLO_MARKET: Record<string, { path: string; locale: string }> = {
  us: { path: 'us', locale: 'en' }, gb: { path: 'uk', locale: 'en' }, ae: { path: 'ae', locale: 'en' },
  de: { path: 'de', locale: 'de' }, fr: { path: 'fr', locale: 'fr' }, in: { path: 'in', locale: 'en' },
}
const UQ = UNIQLO_MARKET[COUNTRY] ?? { path: 'us', locale: 'en' }

// ─── H&M product API ──────────────────────────────────────────────────────────
async function fetchFromHM(query: string, gender: string): Promise<Product[]> {
  const dept = gender === 'female' ? 'ladies' : 'men'
  const url =
    `https://www2.hm.com/${MARKET}/search-results.html` +
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
    try { html = await res.text() } catch (err) { console.warn('H&M response read failed:', err); return [] }
    // H&M embeds JSON in a script tag: window.__INITIAL_STATE__
    const match =
      html.match(/"products":\s*(\[[\s\S]*?\])\s*,\s*"productListFilter"/) ||
      html.match(/"productList":\s*(\[[\s\S]*?\])\s*,\s*"pagination"/) ||
      html.match(/"hits":\s*(\[[\s\S]*?\])\s*,\s*"total"/)
    if (!match) { console.warn('[productSearch] H&M markup changed — no product JSON found'); return [] }
    const productJson = match[1]
    if (!productJson) return []

    let products: any[]
    try { products = JSON.parse(productJson) } catch (err) { console.warn('H&M product JSON parse failed:', err); return [] }
    return products.slice(0, 5).map((p: any) => ({
      name:      p.name || '',
      brand:     'H&M',
      price:     p.price?.value ? `$${p.price.value}` : '',
      url:       p.link ? `https://www2.hm.com${p.link}` : '',  // p.link is already market-prefixed
      image_url: p.images?.[0]?.url || '',
      gender,
      category:  '',
    })).filter((p: Product) => p.url)
  } catch (err) { console.error('H&M fetch failed:', err); return [] }
}

// ─── Uniqlo product API ───────────────────────────────────────────────────────
async function fetchFromUniqlo(query: string, gender: string): Promise<Product[]> {
  const genderParam = gender === 'female' ? 'Women' : 'Men'
  const url =
    `https://www.uniqlo.com/${UQ.path}/api/commerce/v5/${UQ.locale}/products?` +
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
    try { data = await res.json() } catch (err) { console.warn('Uniqlo JSON parse failed:', err); return [] }
    const items: any[] = data?.result?.items || data?.items || []
    return items.slice(0, 5).map((item: any) => ({
      name:      item.name || '',
      brand:     'Uniqlo',
      price:     item.prices?.base?.value?.text || '',
      url:       item.productId ? `https://www.uniqlo.com/${UQ.path}/${UQ.locale}/products/${item.productId}.html` : '',
      image_url: item.mainPic || '',
      gender,
      category:  '',
    })).filter((p: Product) => p.url)
  } catch (err) { console.error('Uniqlo fetch failed:', err); return [] }
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

async function fetchFromPerplexity(query: string, gender: string, category?: string): Promise<Product[]> {
  if (!hasPerplexityConfig()) return []

  try {
    const result = await runPerplexityProSearch(
      [
        {
          role: 'system',
          content: `You find currently shoppable fashion products from real retailer pages. Return only raw JSON. Never invent URLs.`,
        },
        {
          role: 'user',
          content: `Find up to 5 currently shoppable ${gender} fashion products for: "${query}". Shopper country code: "${COUNTRY.toUpperCase()}" — prefer the retailer's site/store for that country so prices are in the local currency and the page actually ships there.

Prefer official retailer/product pages that can be purchased online. Use web search and fetch specific product pages when useful. "price" must be the CURRENT price shown on the page including its currency symbol (e.g. "$29.90", "AED 129", "£24.99") — never guess or reuse stale prices.

Return ONLY this JSON array shape:
[
  {
    "name": "Product name",
    "brand": "Brand",
    "price": "Price text or empty string",
    "url": "https://direct product or retailer URL",
    "image_url": "https://image URL if available, otherwise empty string"
  }
]

Rules:
- Do not include markdown or explanations.
- URLs must be real http(s) pages found online.
- If you cannot verify a real shoppable page, return [].`,
        },
      ],
      { maxTokens: 900, searchType: 'pro', temperature: 0.1, timeout: 55_000 },
    )

    const parsed = parseJSONFromText<Array<Record<string, unknown>>>(result.content, [])
    const products = parsed
      .map((item) => {
        const url = isHttpUrl(item.url) ? item.url : ''
        if (!url) return null

        return {
          name:      typeof item.name === 'string' ? item.name : query,
          brand:     typeof item.brand === 'string' ? item.brand : '',
          price:     typeof item.price === 'string' ? item.price : '',
          url,
          image_url: isHttpUrl(item.image_url) ? item.image_url : '',
          gender,
          category:  category || '',
        }
      })
      .filter((product): product is Product => Boolean(product))

    if (products.length) return products

    return result.searchResults.slice(0, 5).map((item) => ({
      name:      item.title || query,
      brand:     '',
      price:     '',
      url:       item.url,
      image_url: '',
      gender,
      category:  category || '',
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[productSearch] Perplexity failed:', message)
    return []
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
// Searches for products matching a query + gender.
// 1. Checks Supabase cache (24h TTL)
// 2. Falls back to H&M (authentic brand)
// 3. Falls back to Uniqlo (authentic brand)
// 4. Uses Perplexity Pro Search for live web results from official brand pages

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

  // 2. Try H&M first (authentic brand)
  let products = await fetchFromHM(cleanedQuery, gender)

  // 3. If H&M gives nothing, try Uniqlo
  if (!products.length) {
    products = await fetchFromUniqlo(cleanedQuery, gender)
  }

  // 4. If retailer APIs miss, ask Perplexity Pro Search for current product pages from official brand sites
  if (!products.length) {
    products = await fetchFromPerplexity(cleanedQuery, gender, category)
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
      // Search by item only — a competitor brand name (e.g. "Zara ...") in an
      // H&M/Uniqlo catalog query guarantees zero results. Perplexity still sees
      // the brand via the outfit context when scrapers miss.
      const query = piece.item
      const products = await searchProducts(query, gender, key)
      return [key, products] as [string, Product[]]
    })
  )

  return Object.fromEntries(results)
}
