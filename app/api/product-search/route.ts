import { NextRequest, NextResponse } from 'next/server'
import { searchProducts, searchOutfitPieces } from '@/services/productSearch'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, window: 60 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many product searches' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  try {
    const body = await req.json()

    // Single product search
    if (body.query) {
      const products = await searchProducts(body.query, body.gender || 'male', body.category)
      return NextResponse.json({ products })
    }

    // Batch outfit pieces search
    if (body.pieces) {
      const results = await searchOutfitPieces(body.pieces, body.gender || 'male')
      return NextResponse.json({ results })
    }

    return NextResponse.json({ error: 'Missing query or pieces' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
