import { NextRequest, NextResponse } from 'next/server'
import { getAuthClients } from '@/app/api/auth/_utils'
import { buildGarmentSpinFrames, garmentSpinSignature } from '@/lib/garmentSpin'
import { rateLimit } from '@/lib/rateLimit'
import type { Outfit } from '@/types/outfit'

export const maxDuration = 60

type SpinRequestBody = {
  outfitId?: string | number | null
  outfit?: Outfit | null
  frameCount?: number | null
}

async function getUserIdFromRequest(req: NextRequest) {
  const { authClient } = getAuthClients('outfit spin')
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null

  const { data, error } = await authClient.auth.getUser(authorization.slice('Bearer '.length))
  if (error || !data.user) return null
  return data.user.id
}

function hasGarmentData(outfit: Outfit) {
  return Boolean(outfit.top_wear || outfit.top || outfit.bottom_wear || outfit.shoes || outfit.accessories || outfit.outerwear)
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 8, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many spin requests. Please wait a moment and try again.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await req.json() as SpinRequestBody
    const outfit = body.outfit
    const outfitId = body.outfitId || outfit?.id

    if (!outfit || !outfitId) return NextResponse.json({ error: 'Outfit details are required.' }, { status: 400 })
    if (!hasGarmentData(outfit)) return NextResponse.json({ error: 'This outfit does not have enough garment details for a 360 spin.' }, { status: 400 })

    const frames = buildGarmentSpinFrames(outfit, outfitId, body.frameCount || undefined)

    return NextResponse.json({
      frames,
      signature: garmentSpinSignature(outfit),
      note: 'Experimental 360 spin: side and back views are generated/inferred from the saved garment details.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not build garment spin.'
    console.error('[outfit-spin]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
