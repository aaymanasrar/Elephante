import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'

export type AuthLookupField = 'email' | 'username'

export interface ProfileLookup {
  id: string
  email: string | null
  username: string | null
}

export function normalizeAuthValue(field: AuthLookupField, value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase()
  if (field === 'email') return normalized
  return normalized.replace(/\s+/g, '')
}

export function getAuthClients(context: string) {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', context)
  const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', context)
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', context)

  return {
    authClient: createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    serviceClient: createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  }
}

export async function findProfileByField(
  supabase: SupabaseClient,
  field: AuthLookupField,
  value: string,
) {
  const normalized = normalizeAuthValue(field, value)
  if (!normalized) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username')
    .ilike(field, normalized)
    .limit(50)

  if (error) throw error

  return (data as ProfileLookup[] | null)?.find((profile) => {
    const candidate = field === 'email' ? profile.email : profile.username
    return normalizeAuthValue(field, candidate) === normalized
  }) ?? null
}

export function publicSession(session: { access_token?: string; refresh_token?: string } | null) {
  if (!session?.access_token || !session?.refresh_token) return null

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  }
}
