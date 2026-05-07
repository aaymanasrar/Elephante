const PERPLEXITY_ENDPOINT = 'https://api.perplexity.ai/v1/sonar'
const DEFAULT_MODEL = 'sonar-pro'
const DEFAULT_SEARCH_TYPE = 'auto'

export interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface PerplexitySearchResult {
  title?: string
  url: string
  date?: string | null
  last_updated?: string | null
  snippet?: string
  source?: string
}

export interface PerplexityProSearchResult {
  content: string
  reasoningSteps: unknown[]
  searchResults: PerplexitySearchResult[]
  images: unknown[]
  usage: unknown
  model: string
}

type SearchType = 'auto' | 'pro' | 'fast'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function searchTypeFromEnv(): SearchType {
  const configured = process.env.PERPLEXITY_SEARCH_TYPE?.toLowerCase()
  if (configured === 'pro' || configured === 'fast' || configured === 'auto') return configured
  return DEFAULT_SEARCH_TYPE
}

function readSearchResults(value: unknown): PerplexitySearchResult[] {
  const results: PerplexitySearchResult[] = []

  for (const item of asArray(value)) {
    if (!isRecord(item)) continue
    const url = asString(item.url)
    if (!url) continue

    results.push({
      title: asString(item.title),
      url,
      date: asString(item.date) || null,
      last_updated: asString(item.last_updated) || null,
      snippet: asString(item.snippet),
      source: asString(item.source),
    })
  }

  return results
}

function errorMessage(data: unknown): string {
  if (!isRecord(data)) return 'unknown'
  const error = data.error
  if (typeof error === 'string') return error
  if (isRecord(error) && typeof error.message === 'string') return error.message
  if (typeof data.message === 'string') return data.message
  return 'unknown'
}

function processStreamChunk(chunk: unknown, result: PerplexityProSearchResult) {
  if (!isRecord(chunk)) return

  const choices = asArray(chunk.choices)
  const firstChoice = isRecord(choices[0]) ? choices[0] : null
  const delta = isRecord(firstChoice?.delta) ? firstChoice.delta : null
  const content = asString(delta?.content)
  if (content) result.content += content

  const reasoningSteps = asArray(delta?.reasoning_steps)
  if (reasoningSteps.length) result.reasoningSteps.push(...reasoningSteps)

  const searchResults = readSearchResults(chunk.search_results)
  if (searchResults.length) result.searchResults = searchResults

  const images = asArray(chunk.images)
  if (images.length) result.images = images

  if (chunk.usage) result.usage = chunk.usage
}

function parseJSONLine(line: string): unknown | null {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function stripCodeFence(raw: string) {
  return raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim()
}

function extractJSONCandidate(raw: string) {
  const cleaned = stripCodeFence(raw)
  const arrayStart = cleaned.indexOf('[')
  const objectStart = cleaned.indexOf('{')

  if (arrayStart === -1 && objectStart === -1) return cleaned

  const starts = [arrayStart, objectStart].filter(index => index >= 0).sort((a, b) => a - b)
  for (const start of starts) {
    const endChar = cleaned[start] === '[' ? ']' : '}'
    const end = cleaned.lastIndexOf(endChar)
    if (end > start) return cleaned.slice(start, end + 1)
  }

  return cleaned
}

export function parseJSONFromText<T>(raw: string, fallback: T): T {
  const candidate = extractJSONCandidate(raw)
  try {
    return JSON.parse(candidate) as T
  } catch {
    return fallback
  }
}

export function hasPerplexityConfig() {
  return Boolean(process.env.PERPLEXITY_API_KEY)
}

export async function runPerplexityProSearch(
  messages: PerplexityMessage[],
  options?: {
    maxTokens?: number
    searchType?: SearchType
    temperature?: number
    timeout?: number
  },
): Promise<PerplexityProSearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) throw new Error('Perplexity API key not configured')

  const model = process.env.PERPLEXITY_MODEL || DEFAULT_MODEL
  const response = await fetch(PERPLEXITY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      stream_mode: 'concise',
      max_tokens: options?.maxTokens ?? 900,
      temperature: options?.temperature ?? 0.2,
      web_search_options: {
        search_type: options?.searchType || searchTypeFromEnv(),
      },
    }),
    signal: AbortSignal.timeout(options?.timeout ?? 45_000),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(`Perplexity failed (${response.status}): ${errorMessage(data)}`)
  }
  if (!response.body) throw new Error('Perplexity returned an empty stream')

  const result: PerplexityProSearchResult = {
    content: '',
    reasoningSteps: [],
    searchResults: [],
    images: [],
    usage: null,
    model,
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    pending += decoder.decode(value, { stream: true })
    const events = pending.split(/\r?\n\r?\n/)
    pending = events.pop() || ''

    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('\n')

      if (!data || data === '[DONE]') continue
      processStreamChunk(parseJSONLine(data), result)
    }
  }

  if (pending.trim()) {
    const data = pending
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .join('\n')
    if (data && data !== '[DONE]') processStreamChunk(parseJSONLine(data), result)
  }

  return result
}
