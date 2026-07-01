'use client'

import Image from 'next/image'
import { useState } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useLocale } from '@/lib/locale-context'

interface StylistsVisionProps {
  prompt: string
  imageUrl?: string
  className?: string
  onImageLoaded?: () => void
}

export default function StylistsVision({
  prompt,
  imageUrl,
  className = '',
  onImageLoaded,
}: StylistsVisionProps) {
  const { isAr } = useLocale()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  if (!prompt && !imageUrl) return null

  const url = imageUrl || `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`

  const handleLoadingComplete = () => {
    setLoading(false)
    onImageLoaded?.()
  }

  const handleError = () => {
    setError(true)
    setLoading(false)
  }

  if (error) {
    return (
      <div
        className={`
          w-full aspect-square
          rounded-2xl bg-zinc-800/50 border border-white/10
          flex items-center justify-center
          ${className}
        `}
      >
        <div className="text-center px-4" dir={isAr ? 'rtl' : 'ltr'}>
          <p className="text-sm text-zinc-400 mb-2">
            {isAr ? 'تعذر تحميل الصورة' : 'Could not load image'}
          </p>
          <p className="text-xs text-zinc-500">
            {isAr ? 'يرجى المحاولة مرة أخرى' : 'Please try again'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`
        relative w-full aspect-square
        rounded-2xl overflow-hidden
        bg-zinc-900 border border-white/10
        shadow-[0_12px_40px_rgba(0,0,0,0.3)]
        group
        ${className}
      `}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm z-10">
          <LoadingSpinner />
        </div>
      )}

      <Image
        src={url}
        alt="Stylist's Vision"
        fill
        className="object-cover"
        onLoadingComplete={handleLoadingComplete}
        onError={handleError}
        unoptimized
        priority
      />

      {/* Overlay label */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-3 z-20">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-amber-100 uppercase tracking-widest">
            {isAr ? "رؤية المصمم" : "Stylist's Vision"}
          </span>
        </div>
      </div>

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
    </div>
  )
}
