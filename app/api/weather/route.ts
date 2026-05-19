import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

function wmoToCondition(code: number): string {
  if (code === 0)                          return 'Clear sky'
  if (code >= 1  && code <= 3)             return 'Partly cloudy'
  if (code >= 45 && code <= 48)            return 'Foggy'
  if (code >= 51 && code <= 67)            return 'Rainy'
  if (code >= 71 && code <= 77)            return 'Snowy'
  if (code >= 80 && code <= 82)            return 'Showers'
  if (code >= 95 && code <= 99)            return 'Thunderstorm'
  return 'Cloudy'
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, window: 60 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  try {
    const { city } = await req.json()
    if (!city || typeof city !== 'string') {
      return NextResponse.json({ error: 'city required' }, { status: 400 })
    }

    // 1. Geocode city → lat/lon
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=en&format=json`
    const geoRes = await fetch(geoUrl)
    if (!geoRes.ok) {
      return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 502 })
    }
    const geoData = await geoRes.json()

    if (!geoData.results || geoData.results.length === 0) {
      return NextResponse.json({ error: 'City not found' }, { status: 404 })
    }

    const { latitude, longitude, name } = geoData.results[0]

    // 2. Fetch current weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,wind_speed_10m&temperature_unit=celsius`
    const weatherRes = await fetch(weatherUrl)
    if (!weatherRes.ok) {
      return NextResponse.json({ error: 'Weather service unavailable' }, { status: 502 })
    }
    const weatherData = await weatherRes.json()

    const current = weatherData.current
    const temperature_c: number = current.temperature_2m
    const condition: string     = wmoToCondition(current.weathercode)
    const wind_kph: number      = current.wind_speed_10m

    return NextResponse.json({ city: name, temperature_c, condition, wind_kph })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[weather]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
