'use client'

import { useLocale } from '@/lib/locale-context'

interface CulturalTagsProps {
  tags: string[]
  className?: string
}

export default function CulturalTags({ tags, className = '' }: CulturalTagsProps) {
  const { isAr } = useLocale()

  if (!tags || tags.length === 0) return null

  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {tags.map((tag, index) => (
        <div
          key={`${tag}-${index}`}
          className="
            inline-flex items-center px-3 py-1.5
            rounded-full text-xs font-medium
            bg-gradient-to-r from-amber-500/15 to-orange-500/15
            border border-amber-400/40
            text-amber-100
            backdrop-blur-sm
            hover:border-amber-300/60 hover:bg-gradient-to-r hover:from-amber-500/25 hover:to-orange-500/25
            transition-all duration-200
          "
        >
          <span className="text-amber-300 mr-1.5">#</span>
          <span className="truncate">{tag}</span>
        </div>
      ))}
    </div>
  )
}
