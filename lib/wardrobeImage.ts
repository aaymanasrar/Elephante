import OpenAI, { toFile } from 'openai'
import { removeBackground, type Config as BackgroundRemovalConfig } from '@imgly/background-removal-node'
import sharp from 'sharp'
import { getOpenAIKeys } from '@/lib/openaiKeys'

const CANVAS_SIZE = 1024
const ITEM_BOUNDS = 900
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }
const ALPHA_COMPONENT_THRESHOLD = 12

type PrettifyQuality = 'low' | 'medium' | 'high' | 'auto'
type BackgroundRemovalModel = 'small' | 'medium' | 'large'

export interface WardrobeImagePrettifyResult {
  buffer: Buffer
  contentType: 'image/png'
  extension: 'png'
  provider: string
  aiEdited: boolean
}

type ExtractedImage = {
  buffer: Buffer
  provider: string
  aiEdited: boolean
}

const WARDROBE_PRETTIFY_PROMPT = `Create a clean ecommerce catalog cutout from this clothing photo.
Preserve the exact garment: color, print, logos, silhouette, fabric texture, length, fit, and all details.
Remove everything that is not the garment itself — background, room, floor, hands, hanger, model's face, skin, hair, and body.
Present the garment as a ghost mannequin (invisible body, garment retains its 3-D shape) or a flat-lay on a transparent background, with soft even studio lighting.
Never show any visible face, skin, hair, or body parts. No text, watermarks, extra props, or decorative elements.`

function normalizePrettifyQuality(value?: string): PrettifyQuality {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'auto') return value
  return 'medium'
}

function normalizeBackgroundRemovalModel(value?: string): BackgroundRemovalModel {
  if (value === 'small' || value === 'medium' || value === 'large') return value
  return 'medium'
}

function isPrettifyEnabled() {
  return process.env.WARDROBE_PRETTIFY_ENABLED !== 'false'
}

function readDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,([\s\S]+)$/)
  if (!match?.[2]) return null
  return Buffer.from(match[2].replace(/\s/g, ''), 'base64')
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

async function prepareSourceImage(buffer: Buffer) {
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: 1536,
      height: 1536,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toColorspace('srgb')
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

async function downloadImageBuffer(imageUrl: string) {
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(45_000) })
  if (!response.ok) throw new Error(`Prettified image download failed (${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

async function blobToBuffer(blob: Blob) {
  return Buffer.from(await blob.arrayBuffer())
}

async function removeStrayAlphaComponents(buffer: Buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  if (channels < 4) return buffer

  const pixelCount = width * height
  const labels = new Int32Array(pixelCount)
  const stack = new Int32Array(pixelCount)
  const components: Array<{
    label: number
    area: number
    minX: number
    maxX: number
    minY: number
    maxY: number
    sumX: number
    sumY: number
  }> = []
  let nextLabel = 1

  const isForeground = (index: number) => data[index * channels + 3]! > ALPHA_COMPONENT_THRESHOLD

  for (let i = 0; i < pixelCount; i += 1) {
    if (labels[i] || !isForeground(i)) continue

    const label = nextLabel
    nextLabel += 1
    let stackSize = 0
    stack[stackSize] = i
    stackSize += 1
    labels[i] = label

    let area = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    let sumX = 0
    let sumY = 0

    while (stackSize > 0) {
      stackSize -= 1
      const pixel = stack[stackSize]!
      const x = pixel % width
      const y = Math.floor(pixel / width)

      area += 1
      sumX += x
      sumY += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      const neighbors = [
        x > 0 ? pixel - 1 : -1,
        x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y < height - 1 ? pixel + width : -1,
      ]

      for (const neighbor of neighbors) {
        if (neighbor < 0 || labels[neighbor] || !isForeground(neighbor)) continue
        labels[neighbor] = label
        stack[stackSize] = neighbor
        stackSize += 1
      }
    }

    components.push({ label, area, minX, maxX, minY, maxY, sumX, sumY })
  }

  if (!components.length) return buffer

  const centerX = width / 2
  const centerY = height / 2
  const maxDistance = Math.hypot(centerX, centerY)
  const scored = components.map((component) => {
    const componentX = component.sumX / component.area
    const componentY = component.sumY / component.area
    const distance = Math.hypot(componentX - centerX, componentY - centerY) / maxDistance
    return {
      ...component,
      componentX,
      componentY,
      distance,
      score: component.area * Math.max(0.15, 1 - distance),
    }
  })
  const primary = scored.reduce((best, component) => component.score > best.score ? component : best, scored[0]!)
  const keepLabels = new Set<number>([primary.label])
  const primaryCenterX = primary.componentX
  const primaryCenterY = primary.componentY
  const minMeaningfulArea = pixelCount * 0.002

  for (const component of scored) {
    if (component.label === primary.label) continue

    const distanceFromPrimary = Math.hypot(component.componentX - primaryCenterX, component.componentY - primaryCenterY) / maxDistance
    const isCloseCompanion = component.area >= primary.area * 0.08 && distanceFromPrimary < 0.38
    const isCentralPiece = component.area >= minMeaningfulArea && component.distance < 0.42

    if (isCloseCompanion || isCentralPiece) keepLabels.add(component.label)
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (keepLabels.has(labels[pixel]!)) continue
    const offset = pixel * channels
    data[offset] = 0
    data[offset + 1] = 0
    data[offset + 2] = 0
    data[offset + 3] = 0
  }

  return sharp(data, { raw: { width, height, channels } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function imageFromSamResponse(response: Response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.startsWith('image/')) {
    return Buffer.from(await response.arrayBuffer())
  }

  const data: unknown = await response.json().catch(() => null)
  if (!isRecord(data)) throw new Error('SAM response did not include an image.')

  const value =
    firstString(data.image_base64) ||
    firstString(data.image) ||
    firstString(data.data_url) ||
    firstString(data.url) ||
    firstString(data.output)

  if (!value) throw new Error('SAM response did not include an image.')

  const dataUrl = readDataUrl(value)
  if (dataUrl) return dataUrl

  if (/^https?:\/\//i.test(value)) return downloadImageBuffer(value)

  return Buffer.from(value.replace(/\s/g, ''), 'base64')
}

async function trySamExtract(buffer: Buffer): Promise<ExtractedImage | null> {
  const endpoint = process.env.SAM_SEGMENTATION_URL?.trim()
  if (!endpoint) return null

  try {
    const source = await prepareSourceImage(buffer)
    const formData = new FormData()
    formData.append('image', new Blob([new Uint8Array(source)], { type: 'image/jpeg' }), 'wardrobe-source.jpg')

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(Number(process.env.SAM_SEGMENTATION_TIMEOUT_MS || 90_000)),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`SAM segmentation failed (${response.status}): ${body || response.statusText}`)
    }

    return {
      buffer: await padToCatalogCanvas(await removeStrayAlphaComponents(await imageFromSamResponse(response)), TRANSPARENT),
      provider: 'sam',
      aiEdited: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[wardrobe-image] SAM segmentation failed:', message)
    return null
  }
}

async function tryLocalBackgroundRemoval(buffer: Buffer): Promise<ExtractedImage | null> {
  try {
    const source = await prepareSourceImage(buffer)
    const model = normalizeBackgroundRemovalModel(process.env.WARDROBE_BACKGROUND_REMOVAL_MODEL)
    const config: BackgroundRemovalConfig = {
      model,
      debug: process.env.WARDROBE_BACKGROUND_REMOVAL_DEBUG === 'true',
      output: {
        format: 'image/png',
        quality: 0.95,
      },
    }
    const foreground = await removeBackground(new Blob([new Uint8Array(source)], { type: 'image/jpeg' }), config)
    const cleaned = await removeStrayAlphaComponents(await blobToBuffer(foreground))

    return {
      buffer: await padToCatalogCanvas(cleaned, TRANSPARENT),
      provider: `imgly-background-removal-${model}`,
      aiEdited: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[wardrobe-image] local background removal failed:', message)
    return null
  }
}

async function fitToItemBounds(buffer: Buffer, background: sharp.Color, trim: boolean) {
  const pipeline = sharp(buffer, { failOn: 'none' }).rotate()
  const prepared = trim ? pipeline.trim({ background: TRANSPARENT, threshold: 12 }) : pipeline

  return prepared
    .ensureAlpha()
    .resize({
      width: ITEM_BOUNDS,
      height: ITEM_BOUNDS,
      fit: 'inside',
      withoutEnlargement: false,
      background,
    })
    .toColorspace('srgb')
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true })
}

async function padToCatalogCanvas(buffer: Buffer, background: sharp.Color) {
  let fitted: Awaited<ReturnType<typeof fitToItemBounds>>

  try {
    fitted = await fitToItemBounds(buffer, background, true)
  } catch {
    fitted = await fitToItemBounds(buffer, background, false)
  }

  const { data, info } = fitted

  const width = Math.min(info.width, CANVAS_SIZE)
  const height = Math.min(info.height, CANVAS_SIZE)
  const left = Math.max(0, Math.floor((CANVAS_SIZE - width) / 2))
  const top = Math.max(0, Math.floor((CANVAS_SIZE - height) / 2))

  return sharp(data, { failOn: 'none' })
    .resize({
      width,
      height,
      fit: 'inside',
      withoutEnlargement: true,
      background,
    })
    .extend({
      left,
      right: Math.max(0, CANVAS_SIZE - width - left),
      top,
      bottom: Math.max(0, CANVAS_SIZE - height - top),
      background,
    })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function tryOpenAIPrettify(buffer: Buffer, userId: string): Promise<ExtractedImage | null> {
  if (!isPrettifyEnabled()) return null

  const keys = getOpenAIKeys()
  if (!keys.length) return null

  const source = await prepareSourceImage(buffer)
  const model = process.env.WARDROBE_PRETTIFY_MODEL || 'gpt-image-1'
  const quality = normalizePrettifyQuality(process.env.WARDROBE_PRETTIFY_QUALITY)

  for (const apiKey of keys) {
    try {
      const client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 0 })

      const response = await client.images.edit({
        model,
        image: await toFile(source, 'wardrobe-source.jpg', { type: 'image/jpeg' }),
        prompt: WARDROBE_PRETTIFY_PROMPT,
        size: '1024x1024',
        quality,
        background: 'transparent',
        output_format: 'png',
        input_fidelity: 'high',
        n: 1,
        user: userId,
      })

      const b64 = response.data?.[0]?.b64_json
      const output = b64
        ? Buffer.from(b64.replace(/\s/g, ''), 'base64')
        : response.data?.[0]?.url
          ? await downloadImageBuffer(response.data[0].url)
          : null

      if (output) {
        return {
          buffer: await padToCatalogCanvas(await removeStrayAlphaComponents(output), TRANSPARENT),
          provider: model,
          aiEdited: true,
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.warn('[wardrobe-image] OpenAI prettify failed:', message)
    }
  }

  return null
}

async function tryPhotoroomPrettify(buffer: Buffer): Promise<ExtractedImage | null> {
  const apiKey = process.env.PHOTOROOM_API_KEY?.trim()
  if (!apiKey) return null

  try {
    const source = await prepareSourceImage(buffer)
    const formData = new FormData()
    formData.append(
      'image_file',
      new Blob([new Uint8Array(source)], { type: 'image/jpeg' }),
      'wardrobe-source.jpg',
    )
    formData.append('format', 'png')

    const response = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Photoroom segmentation failed (${response.status}): ${errorText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const output = Buffer.from(arrayBuffer)

    return {
      buffer: await padToCatalogCanvas(await removeStrayAlphaComponents(output), TRANSPARENT),
      provider: 'photoroom',
      aiEdited: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[wardrobe-image] Photoroom background removal failed:', message)
    return null
  }
}

export async function prettifyWardrobeImage(buffer: Buffer, userId: string): Promise<WardrobeImagePrettifyResult> {
  const photoroomImage = await tryPhotoroomPrettify(buffer)
  if (photoroomImage) {
    return {
      buffer: photoroomImage.buffer,
      contentType: 'image/png',
      extension: 'png',
      provider: photoroomImage.provider,
      aiEdited: photoroomImage.aiEdited,
    }
  }

  const samImage = await trySamExtract(buffer)
  if (samImage) {
    return {
      buffer: samImage.buffer,
      contentType: 'image/png',
      extension: 'png',
      provider: samImage.provider,
      aiEdited: samImage.aiEdited,
    }
  }

  const localCutout = await tryLocalBackgroundRemoval(buffer)
  if (localCutout) {
    return {
      buffer: localCutout.buffer,
      contentType: 'image/png',
      extension: 'png',
      provider: localCutout.provider,
      aiEdited: localCutout.aiEdited,
    }
  }

  let aiImage: ExtractedImage | null = null

  try {
    aiImage = await tryOpenAIPrettify(buffer, userId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[wardrobe-image] AI prettify setup failed:', message)
  }

  if (aiImage) {
    return {
      buffer: aiImage.buffer,
      contentType: 'image/png',
      extension: 'png',
      provider: aiImage.provider,
      aiEdited: aiImage.aiEdited,
    }
  }

  throw new Error('Could not isolate the clothing pieces. Please upload a clearer photo with the garments visible.')
}
