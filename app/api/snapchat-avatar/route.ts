import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const username = req.nextUrl.searchParams.get('username')?.trim().replace(/^@/, '')
  if (!username || !/^[a-zA-Z0-9._-]{1,30}$/.test(username)) {
    return NextResponse.json({ error: 'Invalid Snapchat username' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://www.snapchat.com/add/${encodeURIComponent(username)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(8_000),
    })

    if (res.status === 404) {
      return NextResponse.json({ error: 'Snapchat user not found' }, { status: 404 })
    }
    if (!res.ok) {
      return NextResponse.json({ error: 'Could not reach Snapchat' }, { status: 502 })
    }

    const html = await res.text()

    // 1. Bitmoji CDN URLs embedded in the page
    const bitmojiPatterns = [
      /https:\/\/sdk\.bitmoji\.com\/render\/[^\s"'<>\\]+/,
      /https:\/\/cdn\.bitmoji\.com\/[^\s"'<>\\]+\.png/,
      /https:\/\/images\.bitmoji\.com\/[^\s"'<>\\]+/,
    ]
    for (const pattern of bitmojiPatterns) {
      const match = html.match(pattern)
      if (match) {
        const url = match[0].replace(/\\u0026/g, '&').replace(/\\/g, '')
        return NextResponse.json({ avatarUrl: url })
      }
    }

    // 2. Fallback: og:image (usually the Snapcode, not Bitmoji — still usable as avatar)
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/)
    if (ogMatch?.[1]) {
      return NextResponse.json({ avatarUrl: ogMatch[1], isFallback: true })
    }

    return NextResponse.json(
      { error: 'Avatar not found. Try uploading a photo instead.' },
      { status: 404 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch Snapchat profile'
    if (msg.includes('abort') || msg.includes('timeout')) {
      return NextResponse.json({ error: 'Snapchat took too long to respond' }, { status: 504 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
