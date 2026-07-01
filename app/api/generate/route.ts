import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { requireEnv } from '@/lib/env'

export const runtime = 'nodejs'

const FAL_BASE_URL = 'https://queue.fal.run'
const FAL_MODEL = 'fal-ai/flux/schnell'
const FAL_REQUEST_TIMEOUT_MS = 15_000
const FAL_POLL_TIMEOUT_MS = 120_000
const FAL_POLL_INTERVAL_MS = 3_000

function getSupabaseClients() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'the image generation route')
  const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'the image generation route')
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'the image generation route')

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceClient: createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  }
}

async function getAuthenticatedUserId(
  request: NextRequest,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<string | null> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await authClient.auth.getUser()
  if (error || !data?.user?.id) return null
  return data.user.id
}

async function reserveImageCredit(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await serviceClient.rpc('deduct_image_credit', {
    request_user_id: userId,
    amount: 1,
    description: 'Image generation reservation',
    metadata: { route: '/api/generate' },
  })

  if (error) {
    const message = error.message || 'Unable to reserve credits.'
    throw new Error(message)
  }

  const payload = Array.isArray(data) ? data[0] : data
  const newBalance = typeof payload === 'number' ? payload : Number(payload)

  if (Number.isNaN(newBalance)) {
    throw new Error('Could not read updated credit balance.')
  }

  return newBalance
}

async function refundImageCredit(
  serviceClient: SupabaseClient,
  userId: string,
  failureMessage: string,
): Promise<void> {
  const { error } = await serviceClient.rpc('refund_image_credit', {
    request_user_id: userId,
    amount: 1,
    description: 'Image generation failure refund',
    metadata: { route: '/api/generate', error: failureMessage.slice(0, 256) },
  })

  if (error) {
    console.error('[generate] refund_image_credit failed:', error.message)
  }
}

function normalizePrompt(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function falFetch(path: string, init: RequestInit = {}) {
  const url = `${FAL_BASE_URL}/${FAL_MODEL}${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Key ${requireEnv('FAL_KEY', 'Fal.ai image generation')}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => response.statusText)
    throw new Error(`Fal.ai request failed (${response.status}): ${body}`)
  }

  return response.json() as Promise<Record<string, unknown>>
}

async function generateFalImage(prompt: string): Promise<string> {
  const start = await falFetch('', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      image_size: 'portrait_9_16',
      num_images: 1,
      safety_tolerance: '2',
      output_format: 'jpeg',
    }),
    signal: AbortSignal.timeout(FAL_REQUEST_TIMEOUT_MS),
  })

  const requestId = typeof start?.request_id === 'string' ? start.request_id : String(start?.request_id || '')
  if (!requestId) {
    throw new Error('Fal.ai did not return a request_id.')
  }

  const deadline = Date.now() + FAL_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, FAL_POLL_INTERVAL_MS))

    const status = await falFetch(`/requests/${requestId}/status`, {
      signal: AbortSignal.timeout(10_000),
    }).catch((error) => {
      console.warn('[generate] Fal.ai status polling failed:', error.message)
      return null
    })

    if (!status) continue

    if (status.status === 'FAILED' || status.status === 'error') {
      const message = typeof status.error === 'string' ? status.error : JSON.stringify(status)
      throw new Error(`Fal.ai generation failed: ${message}`)
    }

    if (status.status === 'COMPLETED') {
      const result = await falFetch(`/requests/${requestId}/response`, {
        signal: AbortSignal.timeout(15_000),
      })
      const imageUrl = Array.isArray(result?.images) ? result.images[0]?.url : undefined
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Fal.ai returned an invalid image URL.')
      }
      return imageUrl
    }
  }

  throw new Error('Fal.ai generation timed out after 120 seconds.')
}

export async function POST(request: NextRequest) {
  const { ok, retryAfter } = rateLimit(request, { limit: 10, window: 60 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  try {
    const { supabaseUrl, supabaseAnonKey, serviceClient } = getSupabaseClients()
    const userId = await getAuthenticatedUserId(request, supabaseUrl, supabaseAnonKey)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const prompt = normalizePrompt(body?.prompt)
    if (!prompt) {
      return NextResponse.json({ error: 'Request body must include a non-empty prompt.' }, { status: 400 })
    }

    const remainingCredits = await reserveImageCredit(serviceClient, userId)

    try {
      const imageUrl = await generateFalImage(prompt)
      return NextResponse.json({
        imageUrl,
        provider: 'fal-ai/flux/schnell',
        remainingCredits,
      })
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : String(generationError)
      await refundImageCredit(serviceClient, userId, message)
      return NextResponse.json({ error: message }, { status: 502 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image generation failed.'
    console.error('[api/generate]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
