const OPENAI_KEY_NAMES = [
  'OPENAI_API_KEY',
  'OPENAI_API_KEY_2',
  'OPENAI_API_KEY_3',
  'OPENAI_API_KEY_BACKUP',
]

export function getOpenAIKeys() {
  const keys = [
    ...OPENAI_KEY_NAMES.map((name) => process.env[name]),
    ...(process.env.OPENAI_API_KEYS || '').split(','),
  ]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key))

  return Array.from(new Set(keys))
}

export function isOpenAIQuotaError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    status?: number
    code?: string
    message?: string
    error?: { code?: string; message?: string }
  }

  const message = `${candidate.message || ''} ${candidate.error?.message || ''}`.toLowerCase()
  const code = `${candidate.code || ''} ${candidate.error?.code || ''}`.toLowerCase()

  return (
    candidate.status === 429 ||
    code.includes('quota') ||
    code.includes('rate_limit') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('429')
  )
}
