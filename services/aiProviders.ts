// ─── Multi-Provider AI Fallback Chain ─────────────────────────────────────────
// Text: GoogleAIStudio (Gemini 2.5 Flash) → Gemini → Groq → Cerebras → NVIDIA → LLM7 → OpenRouter → Mistral → DeepSeek → Claude → OpenAI → Ollama
// Vision: GoogleAIStudio (Gemini 2.5 Flash) → Groq → Claude → Gemini → OpenRouter → Mistral → OpenAI

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { getOpenAIKeys, isOpenAIQuotaError } from '@/lib/openaiKeys'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function parseGeminiCapacityError(err: any): { isCapacityError: boolean; retryDelaySeconds?: number } {
  if (!err) return { isCapacityError: false }

  const errObject = err.error || err
  const status = err.status || errObject?.code || errObject?.status
  const message = `${err.message || ''} ${errObject?.message || ''}`.toLowerCase()

  let isCapacityError = false
  let retryDelaySeconds: number | undefined

  const details = errObject?.details || err?.details
  if (Array.isArray(details)) {
    for (const detail of details) {
      if (
        detail?.reason === 'MODEL_CAPACITY_EXHAUSTED' ||
        (detail?.['@type']?.includes('ErrorInfo') && detail?.reason === 'MODEL_CAPACITY_EXHAUSTED')
      ) {
        isCapacityError = true
      }
      if (detail?.retryDelay) {
        const delayStr = String(detail.retryDelay)
        const match = delayStr.match(/^(\d+(?:\.\d+)?)\s*s?$/i)
        if (match && match[1]) {
          retryDelaySeconds = parseFloat(match[1])
        }
      }
    }
  }

  if (!isCapacityError) {
    if (
      status === 503 ||
      message.includes('model_capacity_exhausted') ||
      message.includes('capacity_exhausted') ||
      message.includes('overloaded') ||
      (message.includes('capacity') && message.includes('exhausted')) ||
      (message.includes('model') && message.includes('exhausted')) ||
      message.includes('temporarily unavailable')
    ) {
      isCapacityError = true
    }
  }

  return { isCapacityError, retryDelaySeconds }
}

// ══════════════════════════════════════════════════════════════════════════════
// PASTE YOUR CLAUDE API KEY IN .env.local:
//   ANTHROPIC_API_KEY=sk-ant-...
// ══════════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content:  string
  provider: string
  model:    string
}

// ─── Text providers (OpenAI-compatible) ──────────────────────────────────────
interface TextProvider {
  name:    string
  apiKey:  string | undefined
  baseURL: string | undefined
  model:   string
}

const TEXT_PROVIDERS: TextProvider[] = [
  // ── Tier 1: Best reasoning + JSON fidelity for fashion tasks ─────────────
  {
    // Gemini 2.5 Flash: fast structured output and fashion reasoning
    name:    'GoogleAIStudio',
    apiKey:  process.env.GOOGLE_AI_STUDIO_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model:   'gemini-2.5-flash',
  },
  {
    // Gemini Flash fallback on a separate key pool
    name:    'Gemini',
    apiKey:  process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model:   'gemini-2.5-flash',
  },
  // ── Tier 2: Fast free inference ───────────────────────────────────────────
  {
    name:    'Groq',
    apiKey:  process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
    model:   'llama-3.3-70b-versatile',
  },
  {
    name:    'Cerebras',
    apiKey:  process.env.CEREBRAS_API_KEY,
    baseURL: 'https://api.cerebras.ai/v1',
    model:   'llama-3.3-70b',
  },
  {
    name:    'NVIDIA',
    apiKey:  process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
    model:   'meta/llama-3.3-70b-instruct',
  },
  {
    name:    'LLM7',
    apiKey:  process.env.LLM7_API_KEY,
    baseURL: 'https://token.llm7.io/v1',
    model:   'meta-llama/llama-3.3-70b-instruct:free',
  },
  {
    name:    'OpenRouter',
    apiKey:  process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    model:   'meta-llama/llama-3.3-70b-instruct:free',
  },
  {
    name:    'Mistral',
    apiKey:  process.env.MISTRAL_API_KEY,
    baseURL: 'https://api.mistral.ai/v1',
    model:   'mistral-small-latest',
  },
  {
    name:    'DeepSeek',
    apiKey:  process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
    model:   'deepseek-chat',
  },
  {
    name:    'Kimi',
    apiKey:  process.env.KIMI_API_KEY,
    baseURL: 'https://api.moonshot.ai/v1',
    model:   'moonshot-v1-8k',
  },
  // ── Tier 2.5: Llama 3.3 (Meta) ───────────────────────────────────────────
  {
    name:    'Together (Llama 3.3)',
    apiKey:  process.env.TOGETHER_API_KEY,
    baseURL: 'https://api.together.xyz/v1',
    model:   'meta-llama/Llama-3.3-70b-Instruct-Turbo',
  },
  // ── Tier 3: Paid fallbacks ────────────────────────────────────────────────
  ...getOpenAIKeys().map((apiKey, index) => ({
    name:    index === 0 ? 'OpenAI' : `OpenAIBackup${index + 1}`,
    apiKey,
    baseURL: undefined,
    model:   'gpt-4o-mini',
  })),
  // ── Tier 4: Local (last resort) ───────────────────────────────────────────
  {
    name:    'Ollama',
    apiKey:  process.env.OLLAMA_MODEL ? (process.env.OLLAMA_API_KEY || 'ollama') : undefined,
    baseURL: 'http://localhost:11434/v1',
    model:   process.env.OLLAMA_MODEL || 'llama3.3',
  },
]

// ─── Claude text fallback (separate SDK) ─────────────────────────────────────
async function tryClaudeText(
  messages: ChatMessage[],
  temperature: number,
  maxTokens?: number,
): Promise<AIResponse | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  try {
    const anthropic = new Anthropic({ apiKey: key })

    const system = messages.find(m => m.role === 'system')?.content || ''
    const userMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-5',
      max_tokens: maxTokens ?? 4096,
      temperature,
      system,
      messages:   userMessages,
    })

    const content = (response.content[0] as any)?.text || ''
    return { content, provider: 'Claude', model: 'claude-sonnet-5' }
  } catch (err: any) {
    console.warn(`[ai] Claude failed: ${err.message} — trying next provider`)
    return null
  }
}


// Create a completion, requesting strict JSON mode when asked. Providers that
// don't support response_format get one automatic retry without it.
async function createCompletion(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number | undefined,
  wantJson: boolean,
) {
  const base = {
    model, messages, temperature,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  }
  if (wantJson) {
    try {
      return await client.chat.completions.create({ ...base, response_format: { type: 'json_object' as const } })
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase()
      if (!msg.includes('response_format') && !msg.includes('json_object')) throw err
      // Provider doesn't support JSON mode — fall through to plain completion
    }
  }
  return client.chat.completions.create(base)
}

// ─── Main text fallback chain ─────────────────────────────────────────────────
export async function chatWithFallback(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; json?: boolean },
): Promise<AIResponse> {
  // JSON tasks want deterministic, schema-faithful output — lower default temp
  const temp      = options?.temperature ?? (options?.json ? 0.4 : 0.8)
  const maxTok    = options?.maxTokens
  const wantJson  = options?.json === true
  const available = TEXT_PROVIDERS.filter(p => p.apiKey)

  if (!available.length && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('No AI provider keys configured. Add GROQ_API_KEY, CEREBRAS_API_KEY, NVIDIA_API_KEY, LLM7_API_KEY, DEEPSEEK_API_KEY, KIMI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to .env.local')
  }

  let lastError: Error | null = null

  for (const provider of available.filter(p => !p.name.startsWith('OpenAI'))) {
    let attempts = 0
    const maxAttempts = 2
    
    while (attempts < maxAttempts) {
      attempts++
      try {
        const extraHeaders = provider.name === 'OpenRouter'
          ? { 'HTTP-Referer': 'https://elephante.app', 'X-OpenRouter-Title': 'Elephante' }
          : {}
        const client = new OpenAI({ apiKey: provider.apiKey!, baseURL: provider.baseURL, timeout: 25000, maxRetries: 0, defaultHeaders: extraHeaders })
        const completion = await createCompletion(client, provider.model, messages, temp, maxTok, wantJson)
        const content = completion.choices[0]?.message?.content || ''
        return { content, provider: provider.name, model: provider.model }
      } catch (err: any) {
        lastError = err
        
        const { isCapacityError, retryDelaySeconds } = parseGeminiCapacityError(err)
        if (isCapacityError && attempts < maxAttempts) {
          const delay = retryDelaySeconds ?? 3
          if (delay <= 15) {
            console.warn(`[ai] ${provider.name} capacity exhausted. Waiting for ${delay}s before retry (attempt ${attempts}/${maxAttempts})...`)
            await sleep(delay * 1000)
            continue
          } else {
            console.warn(`[ai] ${provider.name} capacity exhausted. Retry delay of ${delay}s exceeds threshold (15s) — falling back`)
          }
        }
        
        const reason = isOpenAIQuotaError(err) ? 'quota/rate limit' : err.message
        console.warn(`[ai] ${provider.name} failed: ${reason} — trying next`)
        break // Break retry loop to try the next provider
      }
    }
  }

  const claude = await tryClaudeText(messages, temp, maxTok)
  if (claude) return claude

  const openaiProviders = available.filter(p => p.name.startsWith('OpenAI'))
  for (const openai of openaiProviders) {
    let attempts = 0
    const maxAttempts = 2
    
    while (attempts < maxAttempts) {
      attempts++
      try {
        const client = new OpenAI({ apiKey: openai.apiKey!, timeout: 25000, maxRetries: 0 })
        const completion = await createCompletion(client, openai.model, messages, temp, maxTok, wantJson)
        const content = completion.choices[0]?.message?.content || ''
        return { content, provider: openai.name, model: openai.model }
      } catch (err: any) {
        lastError = err
        
        const { isCapacityError, retryDelaySeconds } = parseGeminiCapacityError(err)
        if (isCapacityError && attempts < maxAttempts) {
          const delay = retryDelaySeconds ?? 3
          if (delay <= 15) {
            console.warn(`[ai] ${openai.name} capacity exhausted. Waiting for ${delay}s before retry (attempt ${attempts}/${maxAttempts})...`)
            await sleep(delay * 1000)
            continue
          } else {
            console.warn(`[ai] ${openai.name} capacity exhausted. Retry delay of ${delay}s exceeds threshold (15s) — falling back`)
          }
        }
        
        const reason = isOpenAIQuotaError(err) ? 'quota/rate limit' : err.message
        console.warn(`[ai] ${openai.name} failed: ${reason} — trying next`)
        break // Break retry loop to try next OpenAI provider
      }
    }
  }

  throw new Error('AI styling is unavailable right now — please try again in a moment')
}

// ─── Vision analysis fallback chain ──────────────────────────────────────────
// Tries each vision-capable provider in order, skips any that fail or have no key
// Order: Groq → GoogleAIStudio → Claude → Gemini → OpenRouter → Mistral → OpenAI
export async function analyzeImageWithFallback(
  imageUrls: string | string[],
  prompt: string,
): Promise<AIResponse> {
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls]
  const images = urls.map(parseVisionImage)
  let lastError: Error | null = null

  // Helper: OpenAI-compatible vision call
  const tryOAI = async (
    apiKey: string,
    baseURL: string | undefined,
    model: string,
    label: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<AIResponse | null> => {
    let attempts = 0
    const maxAttempts = 2
    
    while (attempts < maxAttempts) {
      attempts++
      try {
        const client = new OpenAI({ apiKey, baseURL, timeout: 25000, maxRetries: 0, defaultHeaders: extraHeaders })
        const completion = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: [
            ...images.map(image => ({ type: 'image_url' as const, image_url: { url: image.openAIUrl } })),
            { type: 'text', text: prompt },
          ]}],
          max_tokens: 2048,
        })
        const content = completion.choices[0]?.message?.content || ''
        return { content, provider: label, model }
      } catch (err: any) {
        lastError = err
        
        const { isCapacityError, retryDelaySeconds } = parseGeminiCapacityError(err)
        if (isCapacityError && attempts < maxAttempts) {
          const delay = retryDelaySeconds ?? 3
          if (delay <= 15) {
            console.warn(`[vision] ${label} capacity exhausted. Waiting for ${delay}s before retry (attempt ${attempts}/${maxAttempts})...`)
            await sleep(delay * 1000)
            continue
          } else {
            console.warn(`[vision] ${label} capacity exhausted. Retry delay of ${delay}s exceeds threshold (15s) — falling back`)
          }
        }
        
        console.warn(`[vision] ${label} failed: ${err.message}`)
        break
      }
    }
    return null
  }

  // 1. Google AI Studio — gemini-2.5-flash
  if (process.env.GOOGLE_AI_STUDIO_KEY) {
    const r = await tryOAI(process.env.GOOGLE_AI_STUDIO_KEY, 'https://generativelanguage.googleapis.com/v1beta/openai/', 'gemini-2.5-flash', 'GoogleAIStudio')
    if (r) return r
  }

  // 1.5. ALLaM-7B (text-only — it CANNOT see images, so it must be explicitly
  // opted in via ALLAM_VISION=1; otherwise it hallucinates image analyses)
  if (process.env.ALLAM_VISION === '1' && process.env.HUGGINGFACE_API_KEY && (prompt.toLowerCase().includes('cultural') || prompt.toLowerCase().includes('arabic') || prompt.toLowerCase().includes('أرابي'))) {
    const r = await tryALLaMVision(urls, prompt)
    if (r) return r
  }

  // 2. Groq
  if (process.env.GROQ_API_KEY) {
    const r = await tryOAI(process.env.GROQ_API_KEY, 'https://api.groq.com/openai/v1', 'meta-llama/llama-4-scout-17b-16e-instruct', 'Groq')
    if (r) return r
  }

  // 3. Claude Sonnet
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 2048,
        messages: [{ role: 'user', content: [
          ...images.map(toAnthropicImageBlock),
          { type: 'text',  text: prompt },
        ]}],
      })
      const content = (response.content[0] as any)?.text || ''
      return { content, provider: 'Claude', model: 'claude-sonnet-5' }
    } catch (err: any) {
      console.warn(`[vision] Claude failed: ${err.message}`)
      lastError = err
    }
  }

  // 4. Gemini Flash
  if (process.env.GEMINI_API_KEY) {
    const r = await tryOAI(process.env.GEMINI_API_KEY, 'https://generativelanguage.googleapis.com/v1beta/openai/', 'gemini-2.5-flash', 'Gemini')
    if (r) return r
  }

  // 5. OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    const r = await tryOAI(
      process.env.OPENROUTER_API_KEY,
      'https://openrouter.ai/api/v1',
      'meta-llama/llama-4-scout',
      'OpenRouter',
      { 'HTTP-Referer': 'https://elephante.app', 'X-OpenRouter-Title': 'Elephante' },
    )
    if (r) return r
  }

  // 5.5. Together AI — Llama Vision
  if (process.env.TOGETHER_API_KEY) {
    const r = await tryOAI(
      process.env.TOGETHER_API_KEY,
      'https://api.together.xyz/v1',
      'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      'Together (Llama Vision)',
    )
    if (r) return r
  }

  // 6. Mistral
  if (process.env.MISTRAL_API_KEY) {
    const r = await tryOAI(process.env.MISTRAL_API_KEY, 'https://api.mistral.ai/v1', 'pixtral-12b-2409', 'Mistral')
    if (r) return r
  }

  // 7. OpenAI
  for (const [index, apiKey] of getOpenAIKeys().entries()) {
    const label = index === 0 ? 'OpenAI' : `OpenAIBackup${index + 1}`
    const r = await tryOAI(apiKey, undefined, 'gpt-4o', label)
    if (r) return r
  }

  throw lastError ?? new Error('All vision providers failed')
}

type ParsedVisionImage = {
  openAIUrl: string
  anthropicSource:
    | { type: 'url'; url: string }
    | { type: 'base64'; media_type: AnthropicMediaType; data: string }
}

type AnthropicMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

type AnthropicImageBlock = {
  type: 'image'
  source: ParsedVisionImage['anthropicSource']
}

function toAnthropicMediaType(mediaType: string): AnthropicMediaType {
  const normalized = mediaType.toLowerCase()
  if (normalized === 'image/png' || normalized === 'image/gif' || normalized === 'image/webp') return normalized
  return 'image/jpeg'
}

function parseVisionImage(input: string): ParsedVisionImage {
  const trimmed = input.trim()
  const dataMatch = trimmed.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i)

  if (dataMatch?.[1] && dataMatch?.[2]) {
    return {
      openAIUrl: trimmed,
      anthropicSource: {
        type: 'base64',
        media_type: toAnthropicMediaType(dataMatch[1]),
        data: dataMatch[2].replace(/\s/g, ''),
      },
    }
  }

  return {
    openAIUrl: trimmed,
    anthropicSource: { type: 'url', url: trimmed },
  }
}

function toAnthropicImageBlock(image: ParsedVisionImage): AnthropicImageBlock {
  return {
    type: 'image',
    source: image.anthropicSource,
  }
}

// ─── ALLaM-7B Arabic model via HuggingFace ──────────────────────────────────
async function tryALLaMVision(
  imageUrls: string[],
  prompt: string,
): Promise<AIResponse | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) return null

  try {
    const imageUrlsText = imageUrls.map((url, idx) => `[Image ${idx + 1}]: ${url}`).join('\n')
    const fullPrompt = `${imageUrlsText}\n\n${prompt}`

    const response = await fetch('https://api-inference.huggingface.co/models/humain-ai/ALLaM-7B-Instruct-preview', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 2048,
          temperature: 0.7,
          top_p: 0.95,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText)
      console.warn(`[vision] ALLaM failed: ${response.status} ${error}`)
      return null
    }

    const result = await response.json() as any[]
    const content = result?.[0]?.generated_text || ''
    return { content, provider: 'ALLaM', model: 'ALLaM-7B-Instruct' }
  } catch (err: any) {
    console.warn(`[vision] ALLaM error: ${err.message}`)
    return null
  }
}

// Extract JSON (object or array) from a model response that may include
// markdown fences, preamble text, or minor formatting slop.
export function extractJSON(raw: string): any {
  const cleaned = raw
    .replace(/^[\s\S]*?```(?:json)?\s*/i, m => (m.includes('```') ? '' : m))
    .replace(/```[\s\S]*$/, '')
    .trim() || raw.trim()

  const candidates: string[] = []
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) candidates.push(cleaned)
  const obj = cleaned.match(/\{[\s\S]*\}/)?.[0]
  const arr = cleaned.match(/\[[\s\S]*\]/)?.[0]
  if (obj) candidates.push(obj)
  if (arr) candidates.push(arr)

  for (const candidate of candidates) {
    try { return JSON.parse(candidate) } catch { /* try next */ }
    // Repair common model slop: trailing commas before } or ]
    try { return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')) } catch { /* try next */ }
  }

  console.warn('[ai] extractJSON: no parseable JSON in response:', raw.slice(0, 200))
  return {}
}
