'use client'

import { useRef } from 'react'
import { motion, useAnimationFrame, useMotionValue, useTransform } from 'framer-motion'

interface ShinyTextProps {
  text: string
  disabled?: boolean
  speed?: number
  className?: string
  color?: string
  shineColor?: string
  spread?: number
  pauseOnHover?: boolean
  direction?: 'left' | 'right'
  delay?: number
}

export default function ShinyText({
  text,
  disabled = false,
  speed = 5,
  className = '',
  color = 'rgba(255,255,255,0.35)',
  shineColor = 'rgba(255,255,255,0.9)',
  spread = 25,
  pauseOnHover = false,
  direction = 'left',
  delay = 0,
}: ShinyTextProps) {
  const progress = useMotionValue(0)
  const isPaused = useRef(false)
  const elapsed = useRef(0)

  useAnimationFrame((_, delta) => {
    if (disabled || isPaused.current) return
    elapsed.current += delta / 1000
    const cycle = speed + delay
    const t = (elapsed.current % cycle) / speed
    const clamped = Math.min(t, 1)
    progress.set(direction === 'left' ? clamped : 1 - clamped)
  })

  const backgroundPosition = useTransform(progress, (v) => {
    const pos = 150 - v * 200
    return `${pos}% 50%`
  })

  const gradient = `linear-gradient(
    105deg,
    ${color} 0%,
    ${color} calc(50% - ${spread}%),
    ${shineColor} 50%,
    ${color} calc(50% + ${spread}%),
    ${color} 100%
  )`

  return (
    <motion.span
      onMouseEnter={() => { if (pauseOnHover) isPaused.current = true }}
      onMouseLeave={() => { if (pauseOnHover) isPaused.current = false }}
      className={className}
      style={{
        backgroundImage: gradient,
        backgroundSize: '250% 100%',
        backgroundPosition,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        display: 'inline-block',
      }}
    >
      {text}
    </motion.span>
  )
}
