import OpenAI from 'openai'
import { optionalEnv } from '@/lib/env'
import { generateEdenAIImage, hasEdenAIImageConfig } from '@/lib/edenaiImage'
import { generateFalImage, hasFalImageConfig } from '@/lib/falImage'
import { generateMagnificMysticImage, hasMagnificImageConfig } from '@/lib/magnificImage'
import { buildCatalogMannequinImagePrompt } from '@/lib/outfitImagePrompt'
import { getOpenAIKeys } from '@/lib/openaiKeys'
import { generateRenderOnnxImage, hasRenderOnnxConfig } from '@/lib/renderOnnxServer'
import { generateSkyworkImage, hasSkyworkImageConfig } from '@/lib/skyworkImage'
import { generateTogetherImage, hasTogetherImageConfig } from '@/lib/togetherImage'

export interface MannequinOutfitLike {
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
}

export interface MannequinImageResult {
  url: string
  provider: string
}

type ImageGenerateResponse = {
  data?: Array<{ b64_json?: string; url?: string }>
}

export function seedFromString(value: string): number {
  return Math.abs([...value].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)) % 2147483647
}

export function buildMannequinPromptForOutfit(outfit: MannequinOutfitLike, gender?: string | null): string {
  return buildCatalogMannequinImagePrompt({
    gender: gender || outfit.gender,
    pieces: [outfit.top_wear, outfit.bottom_wear, outfit.shoes, outfit.accessories, outfit.outerwear],
    style: outfit.style || outfit.outfit_name,
    colorScheme: outfit.color_scheme,
    colors: outfit.key_colors,
    extraDetails: [
      outfit.when_to_wear,
      'recreate the provided outfit as faithfully as possible on the mannequin; do not redesign the outfit',
    ],
  })
}

function pollinationsUrl(prompt: string, seed: number): string {
  const token = optionalEnv('POLLINATIONS_TOKEN')
  const params = new URLSearchParams({
    width: '512',
    height: '768',
    nologo: 'true',
    model: 'flux',
    seed: String(seed),
    ...(token ? { token } : {}),
  })
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`
}

export async function generateMannequinOutfitImage(
  outfit: MannequinOutfitLike,
  seed: number,
  gender?: string | null,
): Promise<MannequinImageResult> {
  const prompt = buildMannequinPromptForOutfit(outfit, gender)

  if (hasTogetherImageConfig()) {
    try {
      const { url } = await generateTogetherImage(prompt)
      return { url, provider: 'together-flux' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('[mannequin-image] Together AI failed:', message)
    }
  }

  if (hasFalImageConfig()) {
    try {
      const { resourceUrl, dataUrl } = await generateFalImage(prompt)
      return { url: resourceUrl || dataUrl, provider: 'fal-flux-pro' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('[mannequin-image] FAL.ai failed:', message)
    }
  }

  if (hasRenderOnnxConfig()) {
    try {
      const { dataUrl } = await generateRenderOnnxImage(prompt)
      return { url: dataUrl, provider: 'render-onnx' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('[mannequin-image] Render ONNX failed:', message)
    }
  }

  if (hasSkyworkImageConfig()) {
    try {
      const { resourceUrl, dataUrl } = await generateSkyworkImage(prompt)
      return { url: resourceUrl || dataUrl, provider: 'skywork' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('[mannequin-image] Skywork failed:', message)
    }
  }

  if (hasMagnificImageConfig()) {
    try {
      const { resourceUrl, dataUrl } = await generateMagnificMysticImage(prompt)
      return { url: resourceUrl || dataUrl, provider: 'magnific-mystic' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('[mannequin-image] Magnific failed:', message)
    }
  }

  if (hasEdenAIImageConfig()) {
    try {
      const { dataUrl, resourceUrl } = await generateEdenAIImage(prompt)
      return { url: resourceUrl || dataUrl, provider: 'edenai-seedream' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('[mannequin-image] EdenAI failed:', message)
    }
  }

  for (const apiKey of getOpenAIKeys()) {
    try {
      const client = new OpenAI({ apiKey, timeout: 90_000 })
      const generate = client.images.generate as unknown as (body: {
        model: string
        prompt: string
        size: '1024x1536'
        quality: 'high'
        n: number
      }) => Promise<ImageGenerateResponse>
      const response = await generate({
        model: 'gpt-image-1',
        prompt: `Fashion product catalog photograph. ${prompt}. Pure white seamless studio background, full-body centered composition from head to shoes. Soft studio lighting, crisp realistic garment texture. Smooth white faceless mannequin, no facial features, no skin, no hair. No text, no watermarks, no props.`,
        size: '1024x1536',
        quality: 'high',
        n: 1,
      })
      const b64 = response.data?.[0]?.b64_json
      if (b64) return { url: `data:image/png;base64,${b64}`, provider: 'gpt-image-1' }
      const imageUrl = response.data?.[0]?.url
      if (imageUrl) return { url: imageUrl, provider: 'gpt-image-1' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.warn('[mannequin-image] GPT Image failed:', message)
    }
  }

  return { url: pollinationsUrl(prompt, seed), provider: 'pollinations' }
}
