import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'

export const runtime = 'nodejs'

function getAuthClient(request: NextRequest) {
  let supabaseUrl: string
  let supabaseAnonKey: string
  try {
    supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'the user balance route')
    supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'the user balance route')
  } catch (envErr) {
    console.error('Environment config error:', envErr)
    throw new Error('Server misconfigured')
  }
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Missing authorization header')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(request: NextRequest) {
  try {
    const authClient = getAuthClient(request)
    const { data: authData, error: authError } = await authClient.auth.getUser()

    if (authError || !authData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await authClient
      .from('profiles')
      .select('credit_balance')
      .eq('id', authData.user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Unable to fetch credit balance.' }, { status: 500 })
    }

    return NextResponse.json({ creditBalance: data.credit_balance ?? 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch credit balance.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
