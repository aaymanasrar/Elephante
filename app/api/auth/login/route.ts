import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { findProfileByField, getAuthClients, normalizeAuthValue, publicSession } from '../_utils'

const INVALID_LOGIN = 'Invalid username or password.'

export async function POST(request: NextRequest) {
  const { ok, retryAfter } = rateLimit(request, { limit: 12, window: 60 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    const username = normalizeAuthValue('username', body?.username)
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!username || !password) {
      return NextResponse.json({ error: INVALID_LOGIN }, { status: 400 })
    }

    const { authClient, serviceClient } = getAuthClients('the username login route')
    const profile = await findProfileByField(serviceClient, 'username', username)

    if (!profile?.email) {
      return NextResponse.json({ error: INVALID_LOGIN }, { status: 401 })
    }

    const { data, error } = await authClient.auth.signInWithPassword({
      email: profile.email,
      password,
    })

    const session = publicSession(data.session)
    if (error || !session) {
      return NextResponse.json({ error: INVALID_LOGIN }, { status: 401 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.'
    console.error('[auth/login]', message)
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
  }
}
