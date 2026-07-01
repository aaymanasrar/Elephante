import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { requireEnv } from '@/lib/env'

function getUserClient(token: string) {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'price-watch'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'price-watch'),
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const cookie = req.cookies.get('sb-rqvjgcrlazkppplvhevg-auth-token')?.value
  if (cookie) {
    try { return JSON.parse(decodeURIComponent(cookie))[0] } catch {}
  }
  return null
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 30, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getUserClient(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('price_watches')
    .select(`*, price_history(id, price, currency, checked_at)`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ watches: data ?? [] })
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getUserClient(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { product_url, product_name, brand, image_url, target_price } = body as Record<string, string>

  if (!product_url || !product_name) {
    return NextResponse.json({ error: 'product_url and product_name are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('price_watches')
    .upsert({
      user_id: user.id,
      product_url,
      product_name,
      brand: brand || null,
      image_url: image_url || null,
      target_price: target_price ? parseFloat(target_price) : null,
    }, { onConflict: 'user_id,product_url', ignoreDuplicates: false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ watch: data })
}

export async function DELETE(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getUserClient(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const watchId = searchParams.get('id')
  if (!watchId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('price_watches')
    .delete()
    .eq('id', watchId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
