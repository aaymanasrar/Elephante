'use client'

import { useEffect, useState } from 'react'

export function useKeyboardOffset() {
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const updateOffset = () => {
      const offset = window.innerHeight - viewport.height - (viewport.offsetTop ?? 0)
      setKeyboardOffset(Math.max(0, offset))
    }

    viewport.addEventListener('resize', updateOffset)
    viewport.addEventListener('scroll', updateOffset)

    return () => {
      viewport.removeEventListener('resize', updateOffset)
      viewport.removeEventListener('scroll', updateOffset)
    }
  }, [])

  return keyboardOffset
}

export function useSearchQueryUrlSync(
  searchQuery: string,
  searchParams: URLSearchParams | null | undefined,
  replaceUrl: (url: string) => void
) {
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || '')
    const currentParams = params.toString()

    if (searchQuery) {
      params.set('q', searchQuery)
    } else {
      params.delete('q')
    }

    const nextParams = params.toString()
    if (nextParams === currentParams) return

    replaceUrl(nextParams ? `/feed?${nextParams}` : '/feed')
  }, [replaceUrl, searchParams, searchQuery])
}
