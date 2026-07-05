const seen = new Set<string>()

const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const

function readEnv(name: string) {
  const publicValue = publicEnv[name as keyof typeof publicEnv]
  if (typeof publicValue === 'string' && publicValue.trim()) {
    return publicValue
  }

  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function requireEnv(name: string, context?: string) {
  const value = readEnv(name)
  if (!value) {
    const scope = context ? ` for ${context}` : ''
    throw new Error(`Missing required environment variable ${name}${scope}. Add it to your .env.local file.`)
  }

  return value
}

export function optionalEnv(name: string) {
  return readEnv(name)
}

export function validateRequiredEnv(names: string[], context?: string) {
  // During `next build` env vars may legitimately be absent (e.g. CI without
  // secrets). Warn instead of crashing the build; runtime still throws on use.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
  for (const name of names) {
    const key = `${context || 'global'}:${name}`
    if (seen.has(key)) continue
    if (isBuildPhase) {
      if (!readEnv(name)) console.warn(`[env] ${name} is not set (${context || 'global'}) — required at runtime.`)
    } else {
      requireEnv(name, context)
    }
    seen.add(key)
  }
}
