'use client'

import { useRef } from 'react'
import { motion, useAnimationFrame, useMotionValue, useTransform } from 'framer-motion'

interface GradientTextProps {
  children: React.ReactNode
  colors?: string[]
  animationSpeed?: number
  pauseOnHover?: boolean
  className?: string
}

export default function GradientText({
  children,
  colors = ['#ffffff', '#a0a0a0', '#ffffff', '#606060', '#ffffff'],
  animationSpeed = 8,
  pauseOnHover = false,
  className = '',
}: GradientTextProps) {
  const progress = useMotionValue(0)
  const isPaused = useRef(false)

  useAnimationFrame((_, delta) => {
    if (!isPaused.current) {
      progress.set(progress.get() + delta / 1000 / animationSpeed)
    }
  })

  const backgroundPosition = useTransform(progress, (v) => {
    const pos = (v % 1) * 300
    return `${pos}% 50%`
  })

  const gradient = `linear-gradient(90deg, ${[...colors, colors[0]].join(', ')})`

  return (
    <motion.span
      onMouseEnter={() => { if (pauseOnHover) isPaused.current = true }}
      onMouseLeave={() => { if (pauseOnHover) isPaused.current = false }}
      className={className}
      style={{
        backgroundImage: gradient,
        backgroundSize: '300% 100%',
        backgroundPosition,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        display: 'inline-block',
      }}
    >
      {children}
    </motion.span>
  )
}
