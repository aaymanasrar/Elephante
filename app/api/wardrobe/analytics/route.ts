import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 30, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Resolve user from JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.split(' ')[1],
  )
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [closetRes, wearRes] = await Promise.all([
    supabase.from('closet_items').select('id, category, color, occasion, created_at').eq('user_id', user.id),
    supabase.from('wear_logs').select('outfit_id, worn_at').eq('user_id', user.id),
  ])

  const items = closetRes.data ?? []
  const wearLogs = wearRes.data ?? []

  // Category breakdown
  const categoryCount: Record<string, number> = {}
  for (const item of items) {
    const cat = item.category ?? 'other'
    categoryCount[cat] = (categoryCount[cat] ?? 0) + 1
  }

  // Color frequency
  const colorCount: Record<string, number> = {}
  for (const item of items) {
    if (!item.color) continue
    // color may be "Navy, White" — split and count each
    for (const c of item.color.split(',').map((s: string) => s.trim().toLowerCase())) {
      if (c) colorCount[c] = (colorCount[c] ?? 0) + 1
    }
  }
  const topColors = Object.entries(colorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  // Wear frequency per outfit_id
  const wearFreq: Record<string, number> = {}
  for (const log of wearLogs) {
    if (!log.outfit_id) continue
    wearFreq[log.outfit_id] = (wearFreq[log.outfit_id] ?? 0) + 1
  }

  // Items added per month (last 6 months)
  const now = new Date()
  const monthlyAdded: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyAdded[key] = 0
  }
  for (const item of items) {
    if (!item.created_at) continue
    const d = new Date(item.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (key in monthlyAdded) monthlyAdded[key] = (monthlyAdded[key] ?? 0) + 1
  }

  const totalWears = wearLogs.length
  const uniqueOutfitsWorn = Object.keys(wearFreq).length
  const mostWornId = Object.entries(wearFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return NextResponse.json({
    total_items: items.length,
    category_breakdown: categoryCount,
    top_colors: topColors,
    total_wears: totalWears,
    unique_outfits_worn: uniqueOutfitsWorn,
    most_worn_outfit_id: mostWornId,
    monthly_added: monthlyAdded,
  })
}
