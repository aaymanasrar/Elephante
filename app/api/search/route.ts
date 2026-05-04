import { NextResponse } from 'next/server'

interface SearchIntent {
  occasion: string
  style: string
  color: string
  item: string
  formality: string
  keywords: string[]
}

const OCCASIONS = ['wedding', 'office', 'party', 'date', 'travel', 'beach', 'meeting', 'dinner', 'interview']
const STYLES = ['traditional', 'streetwear', 'formal', 'casual', 'smart casual', 'business casual', 'luxury']
const COLORS = ['black', 'white', 'navy', 'beige', 'cream', 'green', 'red', 'gold', 'silver']
const ITEMS = ['dress', 'abaya', 'thobe', 'blazer', 'shirt', 'pants', 'heels', 'loafers', 'sneakers']
const FORMALITY = ['black tie', 'formal', 'smart', 'casual', 'elevated']

function pickFirstMatch(query: string, values: string[]) {
  return values.find((value) => query.includes(value)) || ''
}

function extractKeywords(query: string) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const query = typeof body?.query === 'string' ? body.query.trim().toLowerCase() : ''

  if (!query) {
    return NextResponse.json({ error: 'Query is required.' }, { status: 400 })
  }

  const keywords = extractKeywords(query)
  const intent: SearchIntent = {
    occasion: pickFirstMatch(query, OCCASIONS),
    style: pickFirstMatch(query, STYLES),
    color: pickFirstMatch(query, COLORS),
    item: pickFirstMatch(query, ITEMS),
    formality: pickFirstMatch(query, FORMALITY),
    keywords,
  }

  if (!intent.occasion && query.includes('wedding')) intent.occasion = 'wedding'
  if (!intent.style && query.includes('saudi')) intent.style = 'traditional'
  if (!intent.item && query.includes('outfit')) intent.item = 'outfit'

  return NextResponse.json(intent)
}
