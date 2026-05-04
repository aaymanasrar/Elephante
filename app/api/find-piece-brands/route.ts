import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'

// Known brand → URL map so AI doesn't hallucinate links
const BRAND_URLS: Record<string, string> = {
  'uniqlo':        'https://www.uniqlo.com/sa/en/men',
  'zara':          'https://www.zara.com/sa/en/man',
  'h&m':           'https://www2.hm.com/en_gb/men.html',
  'hm':            'https://www2.hm.com/en_gb/men.html',
  'nike':          'https://www.nike.com/sa/en',
  'adidas':        'https://www.adidas.com.sa/en',
  'ralph lauren':  'https://www.ralphlauren.co.uk/en/mens',
  'polo ralph lauren': 'https://www.ralphlauren.co.uk/en/mens',
  'hugo boss':     'https://www.hugoboss.com/mens',
  'boss':          'https://www.hugoboss.com/mens',
  'massimo dutti': 'https://www.massimodutti.com/sa',
  'mango':         'https://www.mango.com/en_sa/men',
  'mango man':     'https://www.mango.com/en_sa/men',
  'cos':           'https://www.cos.com/en_gbp/men',
  'marks & spencer': 'https://www.marksandspencer.com/l/men',
  'm&s':           'https://www.marksandspencer.com/l/men',
  'gap':           'https://www.gap.com/browse/men',
  'levi\'s':       'https://www.levis.com/en-gb/c/men',
  'levis':         'https://www.levis.com/en-gb/c/men',
  'tommy hilfiger': 'https://www.tommy.com/en/mens',
  'tommy':         'https://www.tommy.com/en/mens',
  'calvin klein':  'https://www.calvinklein.co.uk/en/mens',
  'ck':            'https://www.calvinklein.co.uk/en/mens',
  'lacoste':       'https://www.lacoste.com/sa',
  'gucci':         'https://www.gucci.com/sa/en/ca/men-c-mens',
  'prada':         'https://www.prada.com/en/gb/mens',
  'armani':        'https://www.armani.com/en-gb/giorgio-armani/man',
  'emporio armani':'https://www.armani.com/en-gb/emporio-armani/man',
  'paul smith':    'https://www.paulsmith.com/en-gb/men',
  'new balance':   'https://www.newbalance.com/men',
  'puma':          'https://eu.puma.com/en/men',
  'vans':          'https://www.vans.co.uk/mens',
  'converse':      'https://www.converse.com/men',
  'timberland':    'https://www.timberland.co.uk/en/c/mens',
  'dr martens':    'https://www.drmartens.com/uk/c/mens-shoes',
  'clarks':        'https://www.clarks.co.uk/en-gb/c/mens-shoes',
  'aldo':          'https://www.aldoshoes.com/uk/en_UK/men',
  'swatch':        'https://www.swatch.com/en-gb/collections/men',
  'casio':         'https://www.casio.com/en/watches',
  'daniel wellington': 'https://www.danielwellington.com/en/collections/men',
  'fossil':        'https://www.fossil.com/en-gb/categories/men',
}

function resolveBrandUrl(brand: string): string | null {
  if (!brand) return null
  const key = brand.toLowerCase().trim()
  if (BRAND_URLS[key]) return BRAND_URLS[key]
  // partial match
  for (const [k, v] of Object.entries(BRAND_URLS)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  // Fallback: Google Shopping search
  return `https://www.google.com/search?q=${encodeURIComponent(brand + ' buy online')}&tbm=shop`
}

export async function POST(req: NextRequest) {
  try {
    const { pieces } = await req.json()
    if (!Array.isArray(pieces) || pieces.length === 0) {
      return NextResponse.json({ brands: [] })
    }

    const prompt = `You are a fashion expert. For each clothing/accessory piece listed, identify the single best-known brand that sells that type of item. Return ONLY a raw JSON array (no markdown, no code blocks) with exactly ${pieces.length} objects in the same order:
[{ "brand": "Brand Name" }, ...]
Rules:
- Use well-known accessible brands like Uniqlo, Zara, H&M, Nike, Adidas, Massimo Dutti, Mango, COS, Ralph Lauren, Hugo Boss, etc.
- If a piece is "null" or not a real item, return { "brand": null }
- Never hallucinate. If unsure, pick the most likely mass-market retailer.

Pieces:
${pieces.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`

    const response = await chatWithFallback([{ role: 'user', content: prompt }], { maxTokens: 400 })
    const parsed: Array<{ brand: string | null }> = extractJSON(response.content)

    const brands = parsed.map((item: { brand: string | null }) => ({
      brand: item.brand || null,
      url:   item.brand ? resolveBrandUrl(item.brand) : null,
    }))

    return NextResponse.json({ brands })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[find-piece-brands]', message)
    return NextResponse.json({ brands: [] })
  }
}
