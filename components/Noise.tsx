'use client'

import { useRef, useEffect } from 'react'
import './Noise.css'

interface NoiseProps {
  patternSize?: number
  patternScaleX?: number
  patternScaleY?: number
  patternRefreshInterval?: number
  patternAlpha?: number
}

const Noise = ({
  patternSize = 250,
  patternScaleX = 1,
  patternScaleY = 1,
  patternRefreshInterval = 2,
  patternAlpha = 15,
}: NoiseProps) => {
  const grainRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = grainRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const effectiveRefreshInterval = reducedMotion ? Number.MAX_SAFE_INTEGER : patternRefreshInterval
    const effectiveCanvasSize = coarsePointer ? 512 : 1024
    const effectiveAlpha = coarsePointer ? Math.min(patternAlpha, 10) : patternAlpha
    const imageData = ctx.createImageData(effectiveCanvasSize, effectiveCanvasSize)
    const data = imageData.data
    let frame = 0
    let animationId: number

    const resize = () => {
      canvas.width = effectiveCanvasSize
      canvas.height = effectiveCanvasSize
      canvas.style.width = '100vw'
      canvas.style.height = '100dvh'
    }

    const drawGrain = () => {
      for (let i = 0; i < data.length; i += 4) {
        const value = Math.random() * 255
        data[i] = value
        data[i + 1] = value
        data[i + 2] = value
        data[i + 3] = effectiveAlpha
      }
      ctx.putImageData(imageData, 0, 0)
    }

    const loop = () => {
      if (frame % effectiveRefreshInterval === 0) drawGrain()
      frame++
      animationId = window.requestAnimationFrame(loop)
    }

    window.addEventListener('resize', resize)
    resize()
    drawGrain()

    if (!reducedMotion) {
      loop()
    }

    return () => {
      window.removeEventListener('resize', resize)
      if (animationId) {
        window.cancelAnimationFrame(animationId)
      }
    }
  }, [patternSize, patternScaleX, patternScaleY, patternRefreshInterval, patternAlpha])

  return (
    <canvas
      className="noise-overlay"
      ref={grainRef}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

export default Noise

