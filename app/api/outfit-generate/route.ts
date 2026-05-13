import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { rateLimit } from '@/lib/rateLimit'
import { generateEdenAIImage, hasEdenAIImageConfig } from '@/lib/edenaiImage'
import { generateMagnificMysticImage, hasMagnificImageConfig } from '@/lib/magnificImage'
import { buildCatalogMannequinImagePrompt } from '@/lib/outfitImagePrompt'
import { generateSkyworkImage, hasSkyworkImageConfig } from '@/lib/skyworkImage'
import { generateFalImage, hasFalImageConfig } from '@/lib/falImage'
import { getOpenAIKeys } from '@/lib/openaiKeys'

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
  gender?: string | null
  alternative?: GeneratedOutfitForImage | null
  skin_tone_match?: boolean
}

function seedFromQuery(query: string): number {
  return Math.abs([...query].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)) % 2147483647
}

function buildImagePrompt(o: GeneratedOutfitForImage, gender?: string | null): string {
  return buildCatalogMannequinImagePrompt({
    gender,
    pieces: [o.top_wear, o.bottom_wear, o.shoes, o.accessories, o.outerwear],
    style: o.style || o.outfit_name,
    colorScheme: o.color_scheme,
    colors: o.key_colors,
    extraDetails: [o.when_to_wear],
  })
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  try {
    const { query, gender, skin_tone, body_shape, height, style_pref, language } = await req.json()
    const responseLanguage = language === 'ar' ? 'Arabic' : 'English'
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const userProfile = [
      `Gender: ${gender || 'male'}`,
      `Skin tone: ${skin_tone || 'medium'}`,
      body_shape && `Body shape: ${body_shape}`,
      height     && `Height: ${height}`,
      style_pref && `Style preference: ${style_pref}`,
    ].filter(Boolean).join('\n')

    // 1. Generate outfit details via Groq (or fallback)
    const result = await chatWithFallback(
      [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `User request: "${query}"\n\nUSER PROFILE:\n${userProfile}\n\nBuild an outfit that directly answers the request AND flatters this user's body shape and skin tone. Write all user-facing outfit text in ${responseLanguage}. Return ONLY raw JSON starting with {`,
        },
      ],
      { maxTokens: 1000, temperature: 0.75 },
    )

    const outfit = extractJSON(result.content) as GeneratedOutfitForImage
    outfit.gender = gender || 'male'

    // 2. Build image URLs, preferring Magnific/EdenAI when configured
    const token = process.env.POLLINATIONS_TOKEN
    function pollinationsUrl(prompt: string, seed: number): string {
      const params = new URLSearchParams({
        width: '512', height: '768',
        nologo: 'true', model: 'flux',
        seed: String(seed),
        ...(token ? { token } : {}),
      })
      return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`
    }

    async function generatedImageUrl(o: GeneratedOutfitForImage, seed: number): Promise<{ url: string; provider: string }> {
      const prompt = buildImagePrompt(o, o.gender || outfit.gender)

      if (hasFalImageConfig()) {
        try {
          const { resourceUrl, dataUrl } = await generateFalImage(prompt)
          return { url: resourceUrl || dataUrl, provider: 'fal-flux-pro' }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.warn('[outfit-generate] FAL.ai failed:', message)
        }
      }

      if (hasSkyworkImageConfig()) {
        try {
          const { resourceUrl, dataUrl } = await generateSkyworkImage(prompt)
          return { url: resourceUrl || dataUrl, provider: 'skywork' }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.warn('[outfit-generate] Skywork failed:', message)
        }
      }

      if (hasMagnificImageConfig()) {
        try {
          const { resourceUrl, dataUrl } = await generateMagnificMysticImage(prompt)
          return { url: resourceUrl || dataUrl, provider: 'magnific-mystic' }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.warn('[outfit-generate] Magnific failed:', message)
        }
      }

      if (hasEdenAIImageConfig()) {
        try {
          const { dataUrl, resourceUrl } = await generateEdenAIImage(prompt)
          return { url: resourceUrl || dataUrl, provider: 'edenai-seedream' }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.warn('[outfit-generate] EdenAI failed:', message)
        }
      }

      const openAIKeys = getOpenAIKeys()
      for (const apiKey of openAIKeys) {
        try {
          const client = new OpenAI({ apiKey, timeout: 90_000 })
          const enhancedPrompt = `Fashion product catalog photograph. ${prompt}. Pure white seamless studio background, full-body centered composition from head to shoes. Soft studio lighting, crisp realistic garment texture. Smooth white faceless mannequin, no facial features, no skin, no hair. No text, no watermarks, no props.`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response = await (client.images.generate as any)({
            model: 'gpt-image-1',
            prompt: enhancedPrompt,
            size: '1024x1536',
            quality: 'high',
            n: 1,
          }) as { data?: Array<{ b64_json?: string; url?: string }> }
          const b64 = response.data?.[0]?.b64_json
          if (b64) return { url: `data:image/png;base64,${b64}`, provider: 'gpt-image-2' }
          const imageUrl = response.data?.[0]?.url
          if (imageUrl) return { url: imageUrl, provider: 'gpt-image-2' }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.warn('[outfit-generate] GPT Image 2 failed:', message)
        }
      }

      return { url: pollinationsUrl(prompt, seed), provider: 'pollinations' }
    }

    const primaryImage = await generatedImageUrl(outfit, seedFromQuery(query))
    const image_url = primaryImage.url

    // 3. Build alternative URL if the primary doesn't suit the skin tone
    let alternative_image_url: string | null = null
    let alternative_image_provider: string | null = null
    if (outfit.alternative && outfit.skin_tone_match === false) {
      outfit.alternative.gender = outfit.gender
      const alternativeImage = await generatedImageUrl(outfit.alternative, seedFromQuery(query + '_alt'))
      alternative_image_url = alternativeImage.url
      alternative_image_provider = alternativeImage.provider
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
