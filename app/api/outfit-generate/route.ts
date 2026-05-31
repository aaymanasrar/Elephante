import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { rateLimit } from '@/lib/rateLimit'
import { generateMannequinOutfitImage, seedFromString } from '@/lib/mannequinImage'
import { buildLocalGeneratedOutfit } from '@/lib/stylistFallback'

export const maxDuration = 300

const SYSTEM = `You are Elephante, a sharp AI fashion stylist. First understand exactly what the user needs — the occasion, the item they own, the mood — then build ONE complete outfit that directly answers their request AND is tailored to their body shape and skin tone.

Body shape rules:
- slim → use relaxed, layered, oversized, chunky silhouettes to add visual bulk. Avoid tight/skinny fits.
- athletic → use straight, tapered, structured pieces. Avoid overly baggy.
- stocky → use dark monochrome, straight cuts, vertical lines. Avoid baggy, wide-leg, or loud prints.
- heavy → use dark tones, straight cuts, structured fabrics. Avoid tight, fitted, or bright colours.
- average → most silhouettes work.

Skin tone colour rules:
- light → earthy neutrals, pastels, navy, burgundy, forest green work well. Avoid washed-out beige.
- medium → warm earthy tones, olive, rust, camel, terracotta, navy work well.
- tan → rich jewel tones, warm earth tones, olive, burgundy, burnt orange work well.
- dark → vibrant colours, bold jewel tones, white, cream, rich earth tones work beautifully. Dark-on-dark also works.

Return ONLY a raw JSON object — no markdown, no code fences:
{
  "outfit_name": "Catchy 2–3 word name",
  "style": "style category (e.g. Smart Casual, Streetwear, Quiet Luxury)",
  "occasions": "occasion1; occasion2",
  "when_to_wear": "brief seasonal or time context",
  "color_scheme": "1 short sentence describing the palette",
  "key_colors": ["#hexcode1", "#hexcode2", "#hexcode3"],
  "top_wear": "exact top — color + garment type + fit that suits their body shape",
  "bottom_wear": "exact bottom — cut and fit that suits their body shape",
  "shoes": "exact shoes",
  "accessories": "accessories or null",
  "outerwear": "outerwear or null",
  "material_top": "fabric of the top",
  "material_bottom": "fabric of the bottom",
  "material_shoes": "material of the shoes",
  "outfit_details": "2–3 sentences: why this works for their specific build and skin tone",
  "skin_tone_match": true,
  "skin_tone_analysis": "1–2 honest sentences about how this palette suits their skin tone.",
  "pro_tip": "One actionable styling tip for their body shape",
  "alternative": null
}

If skin_tone_match is false, replace "alternative": null with:
"alternative": {
  "outfit_name": "Catchy 2–3 word name",
  "style": "style category",
  "occasions": "same occasion as the primary",
  "top_wear": "...",
  "bottom_wear": "...",
  "shoes": "...",
  "accessories": null,
  "outerwear": null,
  "color_scheme": "palette that genuinely flatters this skin tone",
  "key_colors": ["#hex1", "#hex2", "#hex3"],
  "skin_tone_reason": "1 sentence: why this palette works for the skin tone"
}

Gulf/GCC context rules (apply when occasion or query mentions Eid, Ramadan, National Day, Majlis, thobe, bisht, or destination is Gulf):
- For men: Thobe + Bisht for Eid/formal; Thobe alone for Friday Prayer/Majlis; Western formal with kandura accessories for business
- For women: Abaya + modest inner layer; coordinate shayla colour with occasion tone
- Luxury accessories: Patek Philippe or Rolex watch, leather Oxford shoes, silver cufflinks for formal
- Avoid shorts, sleeveless, or overly casual pieces for religious/formal Gulf occasions

Rules:
- If the user mentions a piece they own, INCLUDE it exactly in the primary outfit — then build around it to flatter their shape.
- If the request is a joke-inspired/off-topic detour prompt, make a wearable outfit that reflects the joke through mood, color, or one witty detail. Do not make it a costume.
- Keep it achievable — real everyday items only.
- Max 4 pieces. Only add outerwear/accessories if they genuinely elevate the look.
- skin_tone_analysis must be honest. Bold colours on the wrong undertone clash — say so.`

interface GeneratedOutfitForImage {
  outfit_name?: string | null
  style?: string | null
  top_wear?: string | null
  bottom_wear?: string | null
  shoes?: string | null
  accessories?: string | null
  outerwear?: string | null
  color_scheme?: string | null
  key_colors?: string[] | null
  when_to_wear?: string | null
  outfit_details?: string | null
  skin_tone_analysis?: string | null
  pro_tip?: string | null
  gender?: string | null
  alternative?: GeneratedOutfitForImage | null
  skin_tone_match?: boolean
}

type WeatherPayload = {
  city?: unknown
  temperature_c?: unknown
  condition?: unknown
}

function buildWeatherNote(weather: WeatherPayload | null | undefined, language?: string) {
  const city = typeof weather?.city === 'string' ? weather.city.trim() : ''
  const condition = typeof weather?.condition === 'string' ? weather.condition.trim() : ''
  const temperature = Number(weather?.temperature_c)
  if (!city || !condition || !Number.isFinite(temperature)) return ''

  const roundedTemp = Math.round(temperature)
  if (language === 'ar') {
    return `حسب طقس اليوم في ${city} (${roundedTemp}°C، ${condition})، هذه الإطلالة مناسبة للظروف الحالية.`
  }

  return `According to today's weather in ${city} (${roundedTemp}°C, ${condition}), this outfit is built for the current conditions.`
}

function appendWeatherNote(value: string | null | undefined, note: string) {
  if (!note) return value || null
  if (!value) return note

  const lowerValue = value.toLowerCase()
  if (lowerValue.includes("according to today's weather") || value.includes('حسب طقس اليوم')) return value
  return `${note} ${value}`
}

function applyWeatherNote(outfit: GeneratedOutfitForImage | null | undefined, note: string) {
  if (!outfit || !note) return
  outfit.when_to_wear = appendWeatherNote(outfit.when_to_wear, note)
  outfit.outfit_details = appendWeatherNote(outfit.outfit_details, note)
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  try {
    const { query, gender, skin_tone, body_shape, height, style_pref, language, weather, avatar_url } = await req.json()
    const responseLanguage = language === 'ar' ? 'Arabic' : 'English'
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const userProfile = [
      `Gender: ${gender || 'male'}`,
      `Skin tone: ${skin_tone || 'medium'}`,
      body_shape && `Body shape: ${body_shape}`,
      height     && `Height: ${height}`,
      style_pref && `Style preference: ${style_pref}`,
    ].filter(Boolean).join('\n')

    const weatherNote = buildWeatherNote(weather, language)
    const weatherContext = weather?.city && weather?.temperature_c != null && weather?.condition
      ? `\n\nWEATHER CONTEXT: ${weather.city} is currently ${weather.temperature_c}°C and ${weather.condition}. Factor this into your outfit — choose appropriate fabrics, layers, and pieces for this weather. Do not mention the weather explicitly in outfit_name. Include this weather note in "when_to_wear" or "outfit_details": "${weatherNote}".`
      : ''

    // 1. Generate outfit details via the provider chain; fall back locally if the
    // model is unavailable or returns unusable JSON.
    let outfit: GeneratedOutfitForImage
    try {
      const result = await chatWithFallback(
        [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `User request: "${query}"\n\nUSER PROFILE:\n${userProfile}${weatherContext}\n\nBuild an outfit that directly answers the request AND flatters this user's body shape and skin tone. Write all user-facing outfit text in ${responseLanguage}. Return ONLY raw JSON starting with {`,
          },
        ],
        { maxTokens: 1000, temperature: 0.75 },
      )

      const parsed = extractJSON(result.content) as GeneratedOutfitForImage
      outfit = parsed?.top_wear && parsed?.bottom_wear && parsed?.shoes
        ? parsed
        : buildLocalGeneratedOutfit({ query, gender, skinTone: skin_tone, bodyShape: body_shape, stylePref: style_pref, language, weather })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.warn('[outfit-generate] local stylist fallback:', message)
      outfit = buildLocalGeneratedOutfit({ query, gender, skinTone: skin_tone, bodyShape: body_shape, stylePref: style_pref, language, weather })
    }
    outfit.gender = gender || 'male'
    applyWeatherNote(outfit, weatherNote)
    applyWeatherNote(outfit.alternative, weatherNote)

    // 2. Build image URLs on a clean mannequin
    const primaryImage = await generateMannequinOutfitImage(outfit, seedFromString(query), outfit.gender)
    let image_url = primaryImage.url
    if (avatar_url) {
      const { compositeAvatar } = await import('@/lib/avatarComposition')
      image_url = await compositeAvatar(image_url, avatar_url)
    }

    // 3. Build alternative URL if the primary doesn't suit the skin tone
    let alternative_image_url: string | null = null
    let alternative_image_provider: string | null = null
    if (outfit.alternative && outfit.skin_tone_match === false) {
      outfit.alternative.gender = outfit.gender
      const alternativeImage = await generateMannequinOutfitImage(outfit.alternative, seedFromString(`${query}_alt`), outfit.gender)
      alternative_image_url = alternativeImage.url
      alternative_image_provider = alternativeImage.provider
      if (avatar_url) {
        const { compositeAvatar } = await import('@/lib/avatarComposition')
        alternative_image_url = await compositeAvatar(alternative_image_url, avatar_url)
      }
    }

    return NextResponse.json({
      outfit,
      image_url,
      image_provider: primaryImage.provider,
      alternative_image_url,
      alternative_image_provider,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[outfit-generate]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
