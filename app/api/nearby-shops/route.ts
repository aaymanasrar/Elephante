import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

export interface NearbyShop {
  id: number
  name: string
  type: 'clothing' | 'tailor' | 'department' | 'shoes' | 'general' | 'brand_store'
  distanceM: number
  lat: number
  lon: number
  mapsUrl: string
  address?: string
  brandMatch?: string
}

function escapeOverpassRegex(s: string): string {
  return s.replace(/[[\](){}*+?.\\^$]/g, '\\$&')
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function shopType(tags: Record<string, string>): NearbyShop['type'] {
  const shop = (tags.shop || '').toLowerCase()
  const craft = (tags.craft || '').toLowerCase()
  if (craft === 'tailor' || shop === 'tailor') return 'tailor'
  if (shop === 'department_store') return 'department'
  if (shop === 'shoes' || shop === 'shoe') return 'shoes'
  if (['clothes', 'fashion', 'suit', 'boutique', 'clothing'].includes(shop)) return 'clothing'
  return 'general'
}

const TYPE_PRIORITY: Record<NearbyShop['type'], number> = {
  brand_store: 0, tailor: 1, department: 2, clothing: 3, shoes: 4, general: 5,
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lon = parseFloat(searchParams.get('lon') || '')
  const radiusM = Math.min(parseInt(searchParams.get('radius') || '5000', 10), 10_000)
  const brandsRaw = searchParams.get('brands') || ''
  const brands = brandsRaw.split(',').map(b => b.trim()).filter(Boolean)

  if (!isFinite(lat) || !isFinite(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
  }

  // Brand-specific store queries using name matching
  let brandStoreQuery = ''
  if (brands.length > 0) {
    const brandRegex = brands.map(escapeOverpassRegex).join('|')
    brandStoreQuery = `
  node(around:${radiusM},${lat},${lon})[name~"${brandRegex}",i][shop];
  way(around:${radiusM},${lat},${lon})[name~"${brandRegex}",i][shop];`
  }

  const query = `
[out:json][timeout:14];
(
  node(around:${radiusM},${lat},${lon})[shop~"^(clothes|fashion|suit|tailor|boutique|department_store|shoes|clothing)$",i];
  node(around:${radiusM},${lat},${lon})[craft=tailor];
  way(around:${radiusM},${lat},${lon})[shop~"^(clothes|fashion|suit|tailor|boutique|department_store|shoes|clothing)$",i];
  way(around:${radiusM},${lat},${lon})[craft=tailor];${brandStoreQuery}
);
out center 25;
`.trim()

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(16_000),
    })

    if (!res.ok) throw new Error(`Overpass ${res.status}`)

    const json = await res.json() as { elements: Array<{
      id: number
      type: string
      lat?: number
      lon?: number
      center?: { lat: number; lon: number }
      tags?: Record<string, string>
    }> }

    const seen = new Set<number>()
    const shops: NearbyShop[] = json.elements
      .filter(el => typeof el.tags?.name === 'string' && el.tags.name.trim())
      .filter(el => { if (seen.has(el.id)) return false; seen.add(el.id); return true })
      .map(el => {
        const eLat = el.lat ?? el.center?.lat ?? lat
        const eLon = el.lon ?? el.center?.lon ?? lon
        const tags = el.tags || {}
        const dist = Math.round(haversineM(lat, lon, eLat, eLon))
        const addr = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || undefined
        const name = tags.name as string
        const brandMatch = brands.find(b => name.toLowerCase().includes(b.toLowerCase()))
        const type: NearbyShop['type'] = brandMatch ? 'brand_store' : shopType(tags)

        return {
          id: el.id,
          name,
          type,
          distanceM: dist,
          lat: eLat,
          lon: eLon,
          mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${eLat},${eLon}`,
          address: addr,
          brandMatch,
        } satisfies NearbyShop
      })
      .sort((a, b) => (TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]) || (a.distanceM - b.distanceM))
      .slice(0, 12)

    return NextResponse.json({ shops, userLat: lat, userLon: lon })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch nearby shops'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
