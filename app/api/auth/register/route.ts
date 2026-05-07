import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { findProfileByField, getAuthClients, normalizeAuthValue, publicSession, type AuthLookupField } from '../_utils'

function conflict(field: AuthLookupField) {
  return NextResponse.json(
    {
      error: field === 'email' ? 'Email is already in use.' : 'Username is already in use.',
      field,
    },
    { status: 409 },
  )
}

export async function POST(request: NextRequest) {
  const { ok, retryAfter } = rateLimit(request, { limit: 6, window: 60 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
    const username = normalizeAuthValue('username', body?.username)
    const email = normalizeAuthValue('email', body?.email)
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!fullName || username.length < 2 || !email.includes('@') || password.length < 6) {
      return NextResponse.json({ error: 'Please complete all required fields.' }, { status: 400 })
    }

    const { authClient, serviceClient } = getAuthClients('the registration route')

    const [emailProfile, usernameProfile] = await Promise.all([
      findProfileByField(serviceClient, 'email', email),
      findProfileByField(serviceClient, 'username', username),
    ])

    if (emailProfile) return conflict('email')
    if (usernameProfile) return conflict('username')

    const { data, error } = await authClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, username } },
    })

    if (error) {
      const normalized = error.message.toLowerCase()
      if (normalized.includes('already registered') || normalized.includes('already exists')) {
        return conflict('email')
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data.user?.id) {
      return NextResponse.json({ error: 'Could not create account.' }, { status: 500 })
    }

    const { error: profileError } = await serviceClient
      .from('profiles')
      .upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        username,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (profileError) {
      const normalized = profileError.message.toLowerCase()
      if (normalized.includes('username')) return conflict('username')
      if (normalized.includes('email')) return conflict('email')

      console.error('[auth/register] profile insert failed:', profileError.message)
      return NextResponse.json({ error: 'Account was created, but profile setup failed. Please try logging in.' }, { status: 500 })
    }

    return NextResponse.json({
      session: publicSession(data.session),
      requiresEmailConfirmation: !data.session,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.'
    console.error('[auth/register]', message)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
