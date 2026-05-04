'use client'

import { useEffect, useRef } from 'react'

interface ParticleCanvasProps {
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

export default function ParticleCanvas({
  className = 'fixed inset-0 pointer-events-none z-0',
  desktopCount = 55,
  mobileCount = 55,
}: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const particleCount = reducedMotion ? 0 : coarsePointer ? mobileCount : desktopCount

    let animationFrame = 0
    let width = 0
    let height = 0
    let particles: Particle[] = []

    const resizeCanvas = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    const initializeParticles = () => {
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.4,
        alpha: Math.random() * 0.45 + 0.1,
      }))
    }

    const drawParticles = () => {
      context.clearRect(0, 0, width, height)

      const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.55)
      gradient.addColorStop(0, 'rgba(255,255,255,0.025)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)

      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const first = particles[i]
          const second = particles[j]
          if (!first || !second) continue

          const dx = first.x - second.x
          const dy = first.y - second.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 140) {
            context.beginPath()
            context.strokeStyle = `rgba(255,255,255,${0.055 * (1 - distance / 140)})`
            context.lineWidth = 0.5
            context.moveTo(first.x, first.y)
            context.lineTo(second.x, second.y)
            context.stroke()
          }
        }
      }

      for (const particle of particles) {
        context.beginPath()
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2)
        context.fillStyle = `rgba(255,255,255,${particle.alpha})`
        context.fill()

        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0) particle.x = width
        if (particle.x > width) particle.x = 0
        if (particle.y < 0) particle.y = height
        if (particle.y > height) particle.y = 0
      }

      animationFrame = requestAnimationFrame(drawParticles)
    }

    const handleResize = () => {
      resizeCanvas()
      initializeParticles()

      if (particleCount === 0) {
        context.clearRect(0, 0, width, height)
      }
    }

    resizeCanvas()
    initializeParticles()

    if (particleCount > 0) {
      drawParticles()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', handleResize)
    }
  }, [desktopCount, mobileCount])

  return <canvas ref={canvasRef} className={className} style={{ background: 'transparent' }} />
}
