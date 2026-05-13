const FAL_BASE = 'https://queue.fal.run'
const FAL_MODEL = 'fal-ai/flux-pro/v1.1'

export function hasFalImageConfig(): boolean {
  return Boolean(process.env.FAL_KEY)
}

interface FalResult {
  dataUrl: string
  resourceUrl: string
  model: string
}

async function falFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${FAL_BASE}/${FAL_MODEL}${path}`, {
    ...init,
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FAL.ai ${path} failed (${res.status}): ${body.slice(0, 200)}`)
  }
  return res.json()
}

export async function generateFalImage(prompt: string): Promise<FalResult> {
  // Enqueue
  const { request_id } = await falFetch('', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      image_size: 'portrait_9_16',
      num_images: 1,
      safety_tolerance: '2',
      output_format: 'jpeg',
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!request_id) throw new Error('FAL.ai: no request_id returned')

  // Poll until completed (max 120 s)
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3_000))

    const status = await falFetch(`/requests/${request_id}/status`, {
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null)

    if (!status) continue
    if (status.status === 'FAILED') throw new Error(`FAL.ai generation failed: ${status.error ?? 'unknown'}`)

    if (status.status === 'COMPLETED') {
      const result = await falFetch(`/requests/${request_id}/response`, {
        signal: AbortSignal.timeout(15_000),
      })

      const imageUrl: string = result?.images?.[0]?.url
      if (!imageUrl) throw new Error('FAL.ai: no image URL in response')

      // Download and convert to data URL for consistent handling downstream
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) })
      if (!imgRes.ok) throw new Error(`FAL.ai image download failed (${imgRes.status})`)
      const buf = Buffer.from(await imgRes.arrayBuffer())
      const mime = imgRes.headers.get('content-type') || 'image/jpeg'
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`

      return { dataUrl, resourceUrl: imageUrl, model: FAL_MODEL }
    }
    // IN_QUEUE | IN_PROGRESS → keep polling
  }

  throw new Error('FAL.ai generation timed out after 120 s')
}
