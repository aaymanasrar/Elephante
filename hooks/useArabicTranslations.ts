'use client'

import { useEffect, useMemo, useState } from 'react'

export function useArabicTranslations(texts: Array<string | null | undefined>, enabled: boolean) {
  const [translations, setTranslations] = useState<Record<string, string>>({})

  const uniqueTexts = useMemo(() => {
    return Array.from(new Set(
      texts
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    ))
  }, [texts])
  const textKey = uniqueTexts.join('\u0001')

  useEffect(() => {
    const requestTexts = textKey ? textKey.split('\u0001') : []

    if (!enabled || requestTexts.length === 0) {
      setTranslations({})
      return
    }

    const controller = new AbortController()
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'ar', texts: requestTexts }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.translations && typeof data.translations === 'object') {
          setTranslations(data.translations)
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[translate]', error)
      })

    return () => controller.abort()
  }, [enabled, textKey])

  return (value: string | null | undefined) => {
    if (!value) return value || ''
    return enabled ? translations[value] || value : value
  }
}
