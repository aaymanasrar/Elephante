// ─── Multi-Provider AI Fallback Chain ─────────────────────────────────────────
// Text: GoogleAIStudio (Gemini 2.5 Flash) → Gemini → Groq → Cerebras → NVIDIA → LLM7 → OpenRouter → Mistral → DeepSeek → Claude → OpenAI → Ollama
// Vision: GoogleAIStudio (Gemini 2.5 Flash) → Groq → Claude → Gemini → OpenRouter → Mistral → OpenAI

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { getOpenAIKeys, isOpenAIQuotaError } from '@/lib/openaiKeys'

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
    // Gemini 2.5 Flash: top free model for complex structured output & fashion reasoning
    name:    'GoogleAIStudio',
    apiKey:  process.env.GOOGLE_AI_STUDIO_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model:   'gemini-1.5-flash',
  },
  {
    // Gemini 2.0 Flash: fast fallback on same Google key pool
    name:    'Gemini',
    apiKey:  process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model:   'gemini-1.5-flash',
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
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens ?? 4096,
      temperature,
      system,
      messages:   userMessages,
    })

    const content = (response.content[0] as any)?.text || ''
    return { content, provider: 'Claude', model: 'claude-sonnet-4-6' }
  } catch (err: any) {
    console.warn(`[ai] Claude failed: ${err.message} — trying next provider`)
    return null
  }
}

// ─── Main text fallback chain ─────────────────────────────────────────────────
export async function chatWithFallback(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<AIResponse> {
  const temp      = options?.temperature ?? 0.8
  const maxTok    = options?.maxTokens
  const available = TEXT_PROVIDERS.filter(p => p.apiKey)

  if (!available.length && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('No AI provider keys configured. Add GROQ_API_KEY, CEREBRAS_API_KEY, NVIDIA_API_KEY, LLM7_API_KEY, DEEPSEEK_API_KEY, KIMI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to .env.local')
  }

  let lastError: Error | null = null

  for (const provider of available.filter(p => !p.name.startsWith('OpenAI'))) {
    try {
      const extraHeaders = provider.name === 'OpenRouter'
        ? { 'HTTP-Referer': 'https://elephante.app', 'X-OpenRouter-Title': 'Elephante' }
        : {}
      const client = new OpenAI({ apiKey: provider.apiKey!, baseURL: provider.baseURL, timeout: 25000, maxRetries: 0, defaultHeaders: extraHeaders })
      const completion = await client.chat.completions.create({
        model: provider.model, messages, temperature: temp,
        ...(maxTok ? { max_tokens: maxTok } : {}),
      })
      const content = completion.choices[0]?.message?.content || ''
      return { content, provider: provider.name, model: provider.model }
    } catch (err: any) {
      const reason = isOpenAIQuotaError(err) ? 'quota/rate limit' : err.message
      console.warn(`[ai] ${provider.name} failed: ${reason} — trying next`)
      lastError = err
    }
  }

  const claude = await tryClaudeText(messages, temp, maxTok)
  if (claude) return claude

  const openaiProviders = available.filter(p => p.name.startsWith('OpenAI'))
  for (const openai of openaiProviders) {
    try {
      const client = new OpenAI({ apiKey: openai.apiKey!, timeout: 25000, maxRetries: 0 })
      const completion = await client.chat.completions.create({
        model: openai.model, messages, temperature: temp,
        ...(maxTok ? { max_tokens: maxTok } : {}),
      })
      const content = completion.choices[0]?.message?.content || ''
      return { content, provider: openai.name, model: openai.model }
    } catch (err: any) {
      const reason = isOpenAIQuotaError(err) ? 'quota/rate limit' : err.message
      console.warn(`[ai] ${openai.name} failed: ${reason} — trying next`)
      lastError = err
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
      console.warn(`[vision] ${label} failed: ${err.message}`)
      lastError = err
      return null
    }
  }

  // 1. Google AI Studio — gemini-2.5-flash
  if (process.env.GOOGLE_AI_STUDIO_KEY) {
    const r = await tryOAI(process.env.GOOGLE_AI_STUDIO_KEY, 'https://generativelanguage.googleapis.com/v1beta/openai/', 'gemini-1.5-flash', 'GoogleAIStudio')
    if (r) return r
  }

  // 2. Groq
  if (process.env.GROQ_API_KEY) {
    const r = await tryOAI(process.env.GROQ_API_KEY, 'https://api.groq.com/openai/v1', 'llama-3.2-11b-vision-preview', 'Groq')
    if (r) return r
  }

  // 3. Claude Sonnet
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 2048,
        messages: [{ role: 'user', content: [
          ...images.map(toAnthropicImageBlock),
          { type: 'text',  text: prompt },
        ]}],
      })
      const content = (response.content[0] as any)?.text || ''
      return { content, provider: 'Claude', model: 'claude-sonnet-4-6' }
    } catch (err: any) {
      console.warn(`[vision] Claude failed: ${err.message}`)
      lastError = err
    }
  }

  // 4. Gemini 2.0 Flash
  if (process.env.GEMINI_API_KEY) {
    const r = await tryOAI(process.env.GEMINI_API_KEY, 'https://generativelanguage.googleapis.com/v1beta/openai/', 'gemini-1.5-flash', 'Gemini')
    if (r) return r
  }

  // 5. OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    const r = await tryOAI(
      process.env.OPENROUTER_API_KEY,
      'https://openrouter.ai/api/v1',
      'meta-llama/llama-4-scout:free',
      'OpenRouter',
      { 'HTTP-Referer': 'https://elephante.app', 'X-OpenRouter-Title': 'Elephante' },
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

// Extract JSON from a model response that may include markdown fences or preamble
export function extractJSON(raw: string): any {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```\s*$/im, '')
      .trim()

    const jsonStr = cleaned.startsWith('{')
      ? cleaned
      : (cleaned.match(/\{[\s\S]*\}/) ?? ['{}'])[0]

    return JSON.parse(jsonStr)
  } catch {
    return {}
  }
}
