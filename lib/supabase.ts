import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'

// Lazily initialized so importing this module never throws at build time
// (env vars are only required on first actual use).
let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'the Supabase client'),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'the Supabase client'),
    )
  }
  return _client
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient()
    const value = Reflect.get(client as object, prop, client)
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
})
