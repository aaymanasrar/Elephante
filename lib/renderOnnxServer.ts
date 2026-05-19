const BASE_URL = process.env.RENDER_ONNX_SERVER_URL
const SERVER_KEY = process.env.RENDER_ONNX_SERVER_KEY

export function hasRenderOnnxConfig(): boolean {
  return Boolean(BASE_URL)
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (SERVER_KEY) {
    headers['Authorization'] = `Bearer ${SERVER_KEY}`
  }
  return headers
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function generateRenderOnnxImage(prompt: string): Promise<{ dataUrl: string }> {
  if (!BASE_URL) {
    throw new Error('[render-onnx] RENDER_ONNX_SERVER_URL is not set')
  }

  const response = await fetchWithTimeout(
    `${BASE_URL}/generate`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ prompt, width: 512, height: 768, steps: 4 }),
    },
    120_000,
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `[render-onnx] /generate responded ${response.status} ${response.statusText}: ${text}`,
    )
  }

  const json = (await response.json()) as { b64?: string; image?: string; dataUrl?: string }

  const b64 =
    json.dataUrl?.replace(/^data:image\/\w+;base64,/, '') ??
    json.b64 ??
    json.image

  if (!b64) {
    throw new Error('[render-onnx] /generate response missing base64 image data')
  }

  return { dataUrl: `data:image/png;base64,${b64}` }
}

export async function classifyFashionItem(
  imageUrl: string,
): Promise<{ item_type: string; confidence: number }> {
  if (!BASE_URL) {
    throw new Error('[render-onnx] RENDER_ONNX_SERVER_URL is not set')
  }

  const response = await fetchWithTimeout(
    `${BASE_URL}/classify`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ image_url: imageUrl }),
    },
    30_000,
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `[render-onnx] /classify responded ${response.status} ${response.statusText}: ${text}`,
    )
  }

  const json = (await response.json()) as { item_type?: string; confidence?: number }

  if (typeof json.item_type !== 'string') {
    throw new Error('[render-onnx] /classify response missing item_type field')
  }

  return {
    item_type: json.item_type,
    confidence: typeof json.confidence === 'number' ? json.confidence : 0,
  }
}

export async function extractColorsFromServer(
  imageUrl: string,
): Promise<Array<{ hex: string; name: string; percentage: number }>> {
  if (!BASE_URL) {
    throw new Error('[render-onnx] RENDER_ONNX_SERVER_URL is not set')
  }

  const response = await fetchWithTimeout(
    `${BASE_URL}/colors`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ image_url: imageUrl, n_colors: 6 }),
    },
    30_000,
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `[render-onnx] /colors responded ${response.status} ${response.statusText}: ${text}`,
    )
  }

  const json = (await response.json()) as { colors?: Array<{ hex: string; name: string; percentage: number }> }

  if (!Array.isArray(json.colors)) {
    throw new Error('[render-onnx] /colors response missing colors array')
  }

  return json.colors
}

export async function scoreOutfitCompatibility(
  imageUrls: string[],
  occasion = 'casual',
): Promise<{ score: number; verdict: string; breakdown: Record<string, number> }> {
  if (!BASE_URL) throw new Error('[render-onnx] RENDER_ONNX_SERVER_URL is not set')

  const response = await fetchWithTimeout(
    `${BASE_URL}/compatibility`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ image_urls: imageUrls, occasion }),
    },
    60_000,
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`[render-onnx] /compatibility responded ${response.status}: ${text}`)
  }

  const json = (await response.json()) as { score?: number; verdict?: string; breakdown?: Record<string, number> }
  return {
    score: json.score ?? 0,
    verdict: json.verdict ?? '',
    breakdown: json.breakdown ?? {},
  }
}

export async function segmentGarment(imageUrl: string): Promise<{ dataUrl: string }> {
  if (!BASE_URL) throw new Error('[render-onnx] RENDER_ONNX_SERVER_URL is not set')

  const response = await fetchWithTimeout(
    `${BASE_URL}/segment`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ image_url: imageUrl }),
    },
    45_000,
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`[render-onnx] /segment responded ${response.status}: ${text}`)
  }

  const json = (await response.json()) as { image_b64?: string }
  if (!json.image_b64) throw new Error('[render-onnx] /segment missing image_b64')
  return { dataUrl: `data:image/png;base64,${json.image_b64}` }
}

export async function virtualTryOn(
  personUrl: string,
  garmentUrl: string,
  garmentDescription = '',
): Promise<{ dataUrl: string; provider: string }> {
  if (!BASE_URL) throw new Error('[render-onnx] RENDER_ONNX_SERVER_URL is not set')

  const response = await fetchWithTimeout(
    `${BASE_URL}/tryon`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ person_url: personUrl, garment_url: garmentUrl, garment_description: garmentDescription }),
    },
    150_000, // try-on can take ~60-90s
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`[render-onnx] /tryon responded ${response.status}: ${text}`)
  }

  const json = (await response.json()) as { image_b64?: string; provider?: string }
  if (!json.image_b64) throw new Error('[render-onnx] /tryon missing image_b64')
  return {
    dataUrl: `data:image/jpeg;base64,${json.image_b64}`,
    provider: json.provider ?? 'unknown',
  }
}
