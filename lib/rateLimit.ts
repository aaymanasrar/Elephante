/**
 * Lightweight in-memory rate limiter for Next.js API routes.
 * Resets on cold starts (fine for serverless hobby apps).
 *
 * Usage:
 *   const { ok, retryAfter } = rateLimit(req, { limit: 10, window: 60 })
 *   if (!ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
 */

import { NextRequest } from 'next/server'

interface Window {
  count:     number
  resetAt:   number   // unix ms
}

// Global map survives across requests within the same serverless instance
const store = new Map<string, Window>()

// Prune stale entries every 5 minutes to avoid memory growth
let lastPrune = Date.now()
function maybePrune() {
  const now = Date.now()
  if (now - lastPrune < 5 * 60_000) return
  lastPrune = now
  for (const [key, w] of store) {
    if (w.resetAt < now) store.delete(key)
  }
}

export function rateLimit(
  req: NextRequest,
  opts: { limit: number; window: number },   // window in seconds
): { ok: boolean; retryAfter: number } {
  maybePrune()

  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip =
    forwarded ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const key    = `${req.nextUrl.pathname}::${ip}`
  const now    = Date.now()
  const winMs  = opts.window * 1_000

  let entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + winMs }
    store.set(key, entry)
  }

  if (!entry) {
    entry = { count: 0, resetAt: now + winMs }
    store.set(key, entry)
  }

  entry.count += 1

  if (entry.count > opts.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1_000)
    return { ok: false, retryAfter }
  }

  return { ok: true, retryAfter: 0 }
}
