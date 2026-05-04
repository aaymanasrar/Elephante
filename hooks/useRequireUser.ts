'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getFriendlyDataError } from '@/lib/supabaseErrors'

interface RequireUserState {
  user: User | null
  loading: boolean
  error: string
}

export function useRequireUser(redirectTo = '/login'): RequireUserState {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadUser = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser()
        if (!mounted) return

        if (authError) {
          setError(getFriendlyDataError(authError.message, 'We could not verify your session.'))
          router.replace(redirectTo)
          return
        }

        if (!data.user) {
          router.replace(redirectTo)
          return
        }

        setUser(data.user)
      } catch {
        if (!mounted) return
        setError('We could not verify your session.')
        router.replace(redirectTo)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadUser()

    return () => {
      mounted = false
    }
  }, [redirectTo, router])

  return { user, loading, error }
}
