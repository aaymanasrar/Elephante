'use client'

import Image from 'next/image'
import { useTheme } from '@/lib/theme-context'

interface LogoProps {
  size?: number
  opacity?: number
  className?: string
  decorative?: boolean
  priority?: boolean
}

export default function Logo({
  size = 96,
  opacity = 1,
  className = '',
  decorative = false,
  priority = false,
}: LogoProps) {
  const { resolvedTheme } = useTheme()

  return (
    <div
      className={className}
      aria-hidden={decorative}
      aria-label={decorative ? undefined : 'Elephante'}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        opacity,
        backgroundColor: 'currentColor',
        WebkitMaskImage: 'url(/logo.png.png)',
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskImage: 'url(/logo.png.png)',
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        display: 'inline-block',
      }}
    />
  )
}

