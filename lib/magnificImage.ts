const MAGNIFIC_MYSTIC_ENDPOINT = 'https://api.magnific.com/v1/ai/mystic'
const DEFAULT_MODEL = 'realism'
const DEFAULT_RESOLUTION = '2k'
const DEFAULT_ASPECT_RATIO = 'portrait_2_3'
const DEFAULT_ENGINE = 'automatic'

export interface MagnificImageResult {
  dataUrl: string
  resourceUrl: string
  taskId: string
  model: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

function errorMessage(data: unknown): string {
  if (!isRecord(data)) return 'unknown'
  if (typeof data.message === 'string') return data.message
  const error = data.error
  if (typeof error === 'string') return error
  if (isRecord(error) && typeof error.message === 'string') return error.message
  return 'unknown'
}

async function downloadImageAsDataUrl(imageUrl: string): Promise<string> {
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(25_000) })
  if (!imgRes.ok) throw new Error(`Magnific: failed to download generated image (${imgRes.status})`)
  const buf = await imgRes.arrayBuffer()
  const mime = imgRes.headers.get('content-type') || 'image/jpeg'
  return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
}

function readTask(data: unknown) {
  const wrapper = isRecord(data) ? data.data : null
  const task = isRecord(wrapper) ? wrapper : null
  const taskId = firstString(task?.task_id)
  const status = firstString(task?.status)
  const imageUrl = firstString(task?.generated)

  return { taskId, status, imageUrl }
}

function mysticHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    'x-magnific-api-key': apiKey,
  }
}

export function hasMagnificImageConfig() {
  return Boolean(process.env.MAGNIFIC_API_KEY?.trim())
}

export async function generateMagnificMysticImage(prompt: string): Promise<MagnificImageResult> {
  const apiKey = process.env.MAGNIFIC_API_KEY?.trim()
  if (!apiKey) throw new Error('Magnific API key not configured')

  const model = process.env.MAGNIFIC_MYSTIC_MODEL || DEFAULT_MODEL
  const webhookUrl = process.env.MAGNIFIC_WEBHOOK_URL
  const body: Record<string, unknown> = {
    prompt,
    resolution: process.env.MAGNIFIC_MYSTIC_RESOLUTION || DEFAULT_RESOLUTION,
    aspect_ratio: process.env.MAGNIFIC_MYSTIC_ASPECT_RATIO || DEFAULT_ASPECT_RATIO,
    model,
    creative_detailing: Number(process.env.MAGNIFIC_MYSTIC_CREATIVE_DETAILING || 33),
    engine: process.env.MAGNIFIC_MYSTIC_ENGINE || DEFAULT_ENGINE,
    fixed_generation: false,
    filter_nsfw: true,
  }

  if (webhookUrl) body.webhook_url = webhookUrl

  const createRes = await fetch(MAGNIFIC_MYSTIC_ENDPOINT, {
    method: 'POST',
    headers: mysticHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })

  const createData: unknown = await createRes.json().catch(() => null)
  if (!createRes.ok) throw new Error(`Magnific failed (${createRes.status}): ${errorMessage(createData)}`)

  const created = readTask(createData)
  if (!created.taskId) throw new Error('Magnific: no task_id in response')
  if (created.imageUrl && created.status === 'COMPLETED') {
    return {
      dataUrl: await downloadImageAsDataUrl(created.imageUrl),
      resourceUrl: created.imageUrl,
      taskId: created.taskId,
      model,
    }
  }

  const deadline = Date.now() + Number(process.env.MAGNIFIC_MYSTIC_TIMEOUT_MS || 120_000)
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 3500))

    const taskRes = await fetch(`${MAGNIFIC_MYSTIC_ENDPOINT}/${created.taskId}`, {
      headers: { 'x-magnific-api-key': apiKey },
      signal: AbortSignal.timeout(15_000),
    })

    const taskData: unknown = await taskRes.json().catch(() => null)
    if (!taskRes.ok) throw new Error(`Magnific task poll failed (${taskRes.status}): ${errorMessage(taskData)}`)

    const task = readTask(taskData)
    if (task.status === 'COMPLETED' && task.imageUrl) {
      return {
        dataUrl: await downloadImageAsDataUrl(task.imageUrl),
        resourceUrl: task.imageUrl,
        taskId: created.taskId,
        model,
      }
    }

    if (task.status === 'FAILED') throw new Error('Magnific Mystic generation failed')
  }

  throw new Error('Magnific Mystic generation timed out')
}
