import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

let _supabase: SupabaseClient | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _supabase
}

async function getUserFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await getSupabase().auth.getUser(token)
  return user ?? null
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 30, window: 60 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }

  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { outfit_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { outfit_id } = body
  if (!outfit_id || typeof outfit_id !== 'string') {
    return NextResponse.json({ error: 'outfit_id is required' }, { status: 400 })
  }

  const { error } = await getSupabase().from('wear_logs').insert({ user_id: user.id, outfit_id })
  if (error) {
    console.error('[wear-log POST]', error.message)
    return NextResponse.json({ error: 'Failed to log wear' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 30, window: 60 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }

  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const outfit_id = searchParams.get('outfit_id')
  if (!outfit_id) {
    return NextResponse.json({ error: 'outfit_id query param is required' }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from('wear_logs')
    .select('worn_at')
    .eq('user_id', user.id)
    .eq('outfit_id', outfit_id)
    .order('worn_at', { ascending: false })

  if (error) {
    console.error('[wear-log GET]', error.message)
    return NextResponse.json({ error: 'Failed to fetch wear log' }, { status: 500 })
  }

  const count = data?.length ?? 0
  const last_worn = data?.[0]?.worn_at ?? null

  return NextResponse.json({ count, last_worn })
}
