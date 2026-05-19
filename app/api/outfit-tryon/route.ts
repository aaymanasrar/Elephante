import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { virtualTryOn, hasRenderOnnxConfig } from '@/lib/renderOnnxServer'

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  try {
    const body = await req.json()
    const { person_url, garment_url, garment_description = '' } = body

    if (!person_url || !garment_url) {
      return NextResponse.json({ error: 'person_url and garment_url are required.' }, { status: 400 })
    }

    if (!hasRenderOnnxConfig()) {
      return NextResponse.json({ error: 'AI server not configured.' }, { status: 503 })
    }

    const result = await virtualTryOn(person_url, garment_url, garment_description)

    return NextResponse.json({
      image_url: result.dataUrl,
      provider: result.provider,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Try-on failed'
    console.error('outfit-tryon error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
