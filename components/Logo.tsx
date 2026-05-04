'use client'

import Image from 'next/image'

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
  return (
    <Image
      src="/logo.png.png"
      alt={decorative ? '' : 'Elephante'}
      aria-hidden={decorative}
      priority={priority}
      width={size}
      height={size}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        opacity,
        filter: 'invert(1)',
      }}
    />
  )
}
