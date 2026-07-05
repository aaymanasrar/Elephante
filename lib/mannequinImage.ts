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

const providerCooldowns = new Map<string, number>()
const TEMPORARY_PROVIDER_COOLDOWN_MS = 10 * 60 * 1000
const CONFIG_PROVIDER_COOLDOWN_MS = 60 * 60 * 1000

export function seedFromString(value: string): number {
  return Math.abs([...value].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)) % 2147483647
}

function isProviderCoolingDown(provider: string) {
  return (providerCooldowns.get(provider) || 0) > Date.now()
}

function rememberProviderFailure(provider: string, message: string) {
  const lower = message.toLowerCase()
  const isConfigOrBillingProblem =
    lower.includes('billing') ||
    lower.includes('quota') ||
    lower.includes('balance') ||
    lower.includes('authentication') ||
    lower.includes('invalid api key') ||
    lower.includes('locked') ||
    lower.includes('limit')

  providerCooldowns.set(
    provider,
    Date.now() + (isConfigOrBillingProblem ? CONFIG_PROVIDER_COOLDOWN_MS : TEMPORARY_PROVIDER_COOLDOWN_MS),
  )
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
    // 3:4 portrait at the highest free tier resolution — much sharper garments
    width: '768',
    height: '1152',
    nologo: 'true',
    enhance: 'true', // Pollinations LLM prompt-enhancement pass
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

  if (hasRenderOnnxConfig() && !isProviderCoolingDown('render-onnx')) {
    try {
      const { dataUrl } = await generateRenderOnnxImage(prompt)
      return { url: dataUrl, provider: 'render-onnx' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      rememberProviderFailure('render-onnx', message)
      console.warn('[mannequin-image] Render ONNX failed:', message)
    }
  }

  if (hasTogetherImageConfig() && !isProviderCoolingDown('together-flux')) {
    try {
      const { url } = await generateTogetherImage(prompt)
      return { url, provider: 'together-flux' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      rememberProviderFailure('together-flux', message)
      console.warn('[mannequin-image] Together AI failed:', message)
    }
  }

  if (hasFalImageConfig() && !isProviderCoolingDown('fal-flux-pro')) {
    try {
      const { resourceUrl, dataUrl } = await generateFalImage(prompt)
      return { url: resourceUrl || dataUrl, provider: 'fal-flux-pro' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      rememberProviderFailure('fal-flux-pro', message)
      console.warn('[mannequin-image] FAL.ai failed:', message)
    }
  }

  if (hasSkyworkImageConfig() && !isProviderCoolingDown('skywork')) {
    try {
      const { resourceUrl, dataUrl } = await generateSkyworkImage(prompt)
      return { url: resourceUrl || dataUrl, provider: 'skywork' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      rememberProviderFailure('skywork', message)
      console.warn('[mannequin-image] Skywork failed:', message)
    }
  }

  if (hasMagnificImageConfig() && !isProviderCoolingDown('magnific-mystic')) {
    try {
      const { resourceUrl, dataUrl } = await generateMagnificMysticImage(prompt)
      return { url: resourceUrl || dataUrl, provider: 'magnific-mystic' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      rememberProviderFailure('magnific-mystic', message)
      console.warn('[mannequin-image] Magnific failed:', message)
    }
  }

  if (hasEdenAIImageConfig() && !isProviderCoolingDown('edenai-seedream')) {
    try {
      const { dataUrl, resourceUrl } = await generateEdenAIImage(prompt)
      return { url: resourceUrl || dataUrl, provider: 'edenai-seedream' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      rememberProviderFailure('edenai-seedream', message)
      console.warn('[mannequin-image] EdenAI failed:', message)
    }
  }

  for (const [index, apiKey] of getOpenAIKeys().entries()) {
    const provider = index === 0 ? 'gpt-image-1' : `gpt-image-1-backup-${index + 1}`
    if (isProviderCoolingDown(provider)) continue

    try {
      const client = new OpenAI({ apiKey, timeout: 90_000 })
      const body = {
        model: 'gpt-image-1',
        prompt: `Fashion product catalog photograph. ${prompt}. Pure white seamless studio background, full-body centered composition from head to shoes. Soft studio lighting, crisp realistic garment texture. Smooth white faceless mannequin, no facial features, no skin, no hair. No text, no watermarks, no props.`,
        size: '1024x1536',
        quality: 'high',
        n: 1,
      } as unknown as Parameters<typeof client.images.generate>[0]
      const response = await client.images.generate(body) as ImageGenerateResponse
      const b64 = response.data?.[0]?.b64_json
      if (b64) return { url: `data:image/png;base64,${b64}`, provider: 'gpt-image-1' }
      const imageUrl = response.data?.[0]?.url
      if (imageUrl) return { url: imageUrl, provider: 'gpt-image-1' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      rememberProviderFailure(provider, message)
      console.warn('[mannequin-image] GPT Image failed:', message)
    }
  }

  return { url: pollinationsUrl(prompt, seed), provider: 'pollinations' }
}
