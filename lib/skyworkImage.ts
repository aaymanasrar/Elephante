import { downloadImageAsDataUrl } from '@/lib/edenaiImage'

const SKYWORK_GATEWAY_URL = 'https://api-tools.skywork.ai/theme-gateway'
const DEFAULT_RESOLUTION = '2K'
const DEFAULT_ASPECT_RATIO = '2:3'

const VALID_ASPECT_RATIOS = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
const VALID_RESOLUTIONS = new Set(['1K', '2K', '4K'])

export interface SkyworkImageResult {
  dataUrl: string
  resourceUrl: string
  model: string
}

interface SkyworkImageOptions {
  aspectRatio?: string
  resolution?: string
  timeoutMs?: number
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

function skyworkErrorMessage(data: unknown) {
  if (!isRecord(data)) return 'unknown'
  const message = firstString(data.message) || firstString(data.error) || firstString(data.detail)
  return message || 'unknown'
}

function findSseBoundary(buffer: string) {
  const unix = buffer.indexOf('\n\n')
  const windows = buffer.indexOf('\r\n\r\n')

  if (unix === -1 && windows === -1) return null
  if (unix === -1) return { index: windows, length: 4 }
  if (windows === -1) return { index: unix, length: 2 }
  return unix < windows ? { index: unix, length: 2 } : { index: windows, length: 4 }
}

function parseSseBlock(block: string) {
  let eventType = ''
  const dataLines: string[] = []

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim()
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }

  const rawData = dataLines.join('\n')
  let data: unknown = {}
  if (rawData) {
    try {
      data = JSON.parse(rawData)
    } catch {
      data = { message: rawData }
    }
  }

  return { eventType, data }
}

async function readSkyworkSse(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Skywork: empty response stream')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let boundary = findSseBoundary(buffer)
    while (boundary) {
      const block = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary.length)

      const { eventType, data } = parseSseBlock(block)
      if (eventType === 'success') return data
      if (eventType === 'error') throw new Error(`Skywork failed: ${skyworkErrorMessage(data)}`)

      boundary = findSseBoundary(buffer)
    }
  }

  const tail = buffer.trim()
  if (tail) {
    const { eventType, data } = parseSseBlock(tail)
    if (eventType === 'success') return data
    if (eventType === 'error') throw new Error(`Skywork failed: ${skyworkErrorMessage(data)}`)
  }

  throw new Error('Skywork: no success event in response')
}

function normalizeAspectRatio(value?: string) {
  const candidate = value || process.env.SKYWORK_IMAGE_ASPECT_RATIO || DEFAULT_ASPECT_RATIO
  return VALID_ASPECT_RATIOS.has(candidate) ? candidate : DEFAULT_ASPECT_RATIO
}

function normalizeResolution(value?: string) {
  const candidate = value || process.env.SKYWORK_IMAGE_RESOLUTION || DEFAULT_RESOLUTION
  return VALID_RESOLUTIONS.has(candidate) ? candidate : DEFAULT_RESOLUTION
}

export function hasSkyworkImageConfig() {
  return Boolean(process.env.SKYWORK_API_KEY?.trim())
}

export async function generateSkyworkImage(prompt: string, options: SkyworkImageOptions = {}): Promise<SkyworkImageResult> {
  const apiKey = process.env.SKYWORK_API_KEY?.trim()
  if (!apiKey) throw new Error('Skywork API key not configured')

  const aspectRatio = normalizeAspectRatio(options.aspectRatio)
  const resolution = normalizeResolution(options.resolution)
  const timeoutMs = options.timeoutMs ?? Number(process.env.SKYWORK_IMAGE_TIMEOUT_MS || 150_000)

  const response = await fetch(`${SKYWORK_GATEWAY_URL}/api/sse/image/create`, {
    method: 'POST',
    headers: {
      'Accept': 'text/event-stream',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: prompt.slice(0, 60),
      content: prompt,
      style: { aspect_ratio: aspectRatio },
      options: { resolution },
      source_platform: process.env.SKYWORK_SOURCE_PLATFORM || '',
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Skywork failed (${response.status}): ${body || response.statusText}`)
  }

  const result = await readSkyworkSse(response)
  const resourceUrl = firstString(isRecord(result) ? result.file_url : null)
    || firstString(isRecord(result) ? result.url : null)
    || firstString(isRecord(result) ? result.output : null)

  if (!resourceUrl) throw new Error('Skywork: no image URL in response')

  return {
    dataUrl: await downloadImageAsDataUrl(resourceUrl, 'Skywork', 30_000),
    resourceUrl,
    model: 'skywork-image',
  }
}
