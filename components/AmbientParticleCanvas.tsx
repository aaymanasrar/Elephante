'use client'

import { useEffect, useRef } from 'react'

interface AmbientParticleCanvasProps {
  className?: string
  desktopCount?: number
  mobileCount?: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  alpha: number
}

export default function AmbientParticleCanvas({
  className = 'fixed inset-0 pointer-events-none z-0',
  desktopCount = 36,
  mobileCount = 24,
}: AmbientParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const count = reducedMotion ? 0 : coarsePointer ? mobileCount : desktopCount

    let animationId = 0
    let width = 0
    let height = 0
    let particles: Particle[] = []

    const resize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    const init = () => {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.4,
        alpha: Math.random() * 0.45 + 0.1,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.55)
      gradient.addColorStop(0, 'rgba(255,255,255,0.025)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const first = particles[i]
          const second = particles[j]
          if (!first || !second) continue

          const dx = first.x - second.x
          const dy = first.y - second.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (!coarsePointer && distance < 140) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(255,255,255,${0.055 * (1 - distance / 140)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(first.x, first.y)
            ctx.lineTo(second.x, second.y)
            ctx.stroke()
          }
        }
      }

      for (const particle of particles) {
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${particle.alpha})`
        ctx.fill()

        particle.x += particle.vx
        particle.y += particle.vy
        if (particle.x < 0) particle.x = width
        if (particle.x > width) particle.x = 0
        if (particle.y < 0) particle.y = height
        if (particle.y > height) particle.y = 0
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    init()
    if (count > 0) {
      draw()
    }

    const handleResize = () => {
      resize()
      init()
      if (count === 0) {
        ctx.clearRect(0, 0, width, height)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [desktopCount, mobileCount])

  return <canvas ref={canvasRef} className={className} style={{ background: 'transparent' }} />
}
