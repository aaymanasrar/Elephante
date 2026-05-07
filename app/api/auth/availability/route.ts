import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { findProfileByField, getAuthClients, normalizeAuthValue, type AuthLookupField } from '../_utils'

function isLookupField(value: unknown): value is AuthLookupField {
  return value === 'email' || value === 'username'
}

export async function POST(request: NextRequest) {
  const { ok, retryAfter } = rateLimit(request, { limit: 60, window: 60 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many availability checks. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    const field = body?.field
    if (!isLookupField(field)) {
      return NextResponse.json({ error: 'Invalid availability field.' }, { status: 400 })
    }

    const value = normalizeAuthValue(field, body?.value)
    if (!value) return NextResponse.json({ available: false })

    const { serviceClient } = getAuthClients('the auth availability route')
    const profile = await findProfileByField(serviceClient, field, value)

    return NextResponse.json({ available: !profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Availability check failed.'
    console.error('[auth/availability]', message)
    return NextResponse.json({ error: 'Availability check failed.' }, { status: 500 })
  }
}
