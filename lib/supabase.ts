import { createClient } from '@supabase/supabase-js'
import { requireEnv, validateRequiredEnv } from '@/lib/env'

validateRequiredEnv(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'], 'the Supabase client')

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'the Supabase client')
const supabaseKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'the Supabase client')

export const supabase = createClient(supabaseUrl, supabaseKey)
