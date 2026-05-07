const EDENAI_ENDPOINT = 'https://api.edenai.run/v3/universal-ai'
const DEFAULT_EDENAI_IMAGE_MODEL = 'image/generation/bytedance/seedream-3-0-t2i-250415'
const DEFAULT_EDENAI_IMAGE_RESOLUTION = '1024x1792'

export interface EdenAIImageResult {
  dataUrl: string
  resourceUrl?: string
  cost?: string | number
  model: string
}

export function hasEdenAIImageConfig() {
  return Boolean(process.env.EDENAI_API_KEY)
}

export async function downloadImageAsDataUrl(imageUrl: string, provider: string, timeout = 20_000): Promise<string> {
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(timeout) })
  if (!imgRes.ok) throw new Error(`${provider}: failed to download generated image`)
  const buf    = await imgRes.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')
  const mime   = imgRes.headers.get('content-type') || 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = firstString(item)
      if (match) return match
    }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function edenAIErrorMessage(data: unknown): string {
  if (!isRecord(data)) return 'unknown'

  const { error, message } = data
  if (typeof error === 'string') return error
  if (isRecord(error) && typeof error.message === 'string') return error.message
  if (typeof message === 'string') return message
  return 'unknown'
}

async function normalizeGeneratedImage(value: string, provider: string): Promise<string> {
  if (value.startsWith('data:image/')) return value
  if (/^https?:\/\//i.test(value)) return downloadImageAsDataUrl(value, provider)
  return `data:image/png;base64,${value.replace(/\s/g, '')}`
}

export async function generateEdenAIImage(prompt: string): Promise<EdenAIImageResult> {
  const apiKey = process.env.EDENAI_API_KEY
  if (!apiKey) throw new Error('EdenAI key not configured')

  const model      = process.env.EDENAI_IMAGE_MODEL || DEFAULT_EDENAI_IMAGE_MODEL
  const resolution = process.env.EDENAI_IMAGE_RESOLUTION || DEFAULT_EDENAI_IMAGE_RESOLUTION

  const response = await fetch(EDENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: {
        text: prompt,
        resolution,
        num_images: 1,
      },
      show_original_response: false,
    }),
    signal: AbortSignal.timeout(90_000),
  })

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`EdenAI failed (${response.status}): ${edenAIErrorMessage(data)}`)
  if (!isRecord(data) || data.status !== 'success') throw new Error(`EdenAI generation failed: ${edenAIErrorMessage(data)}`)

  const output = isRecord(data.output) ? data.output : null
  const image = firstString(output?.image) || firstString(output?.image_resource_url)
  if (!image) throw new Error('EdenAI: no image in response')

  const resourceUrl = firstString(output?.image_resource_url) || undefined
  const cost = typeof data.cost === 'string' || typeof data.cost === 'number' ? data.cost : undefined

  return {
    dataUrl: await normalizeGeneratedImage(image, 'EdenAI'),
    resourceUrl,
    cost,
    model,
  }
}
