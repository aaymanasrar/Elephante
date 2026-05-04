'use client'

import { useCallback, useEffect, useState } from 'react'

interface Step {
  id: string
  title: string
  description: string
  targetId: string
  preferredPlacement: 'bottom' | 'left'
}

const STEPS: Step[] = [
  {
    id: 'ai-stylist',
    title: 'Elephante AI',
    description: 'Your personal AI stylist. Tap to get curated outfit recommendations tailored to your style.',
    targetId: 'tour-ai-stylist',
    preferredPlacement: 'bottom',
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Tap your name to view your style profile, saved looks, and personal preferences.',
    targetId: 'tour-profile',
    preferredPlacement: 'bottom',
  },
  {
    id: 'closet',
    title: 'Your Closet',
    description: 'Browse and manage your wardrobe archive, every outfit organized and curated.',
    targetId: 'tour-closet',
    preferredPlacement: 'left',
  },
  {
    id: 'search',
    title: 'Search',
    description: 'Search for any outfit by style, occasion, color, or vibe. Try "business casual" or "wedding".',
    targetId: 'tour-search',
    preferredPlacement: 'bottom',
  },
]

export default function IntroTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 700)
    return () => clearTimeout(timer)
  }, [])

  const current = STEPS[step] ?? STEPS[0]!

  const updateRect = useCallback(() => {
    const element = document.getElementById(current.targetId)
    if (!element) {
      setTargetRect(null)
      return
    }

    setTargetRect(element.getBoundingClientRect())
  }, [current.targetId])

  useEffect(() => {
    if (!visible) return
    const element = document.getElementById(current.targetId)
    let frame = 0
    const observer = typeof ResizeObserver !== 'undefined' && element
      ? new ResizeObserver(() => updateRect())
      : null
    const fallbackInterval = observer ? null : window.setInterval(updateRect, 250)
    const handleScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        updateRect()
      })
    }

    updateRect()
    if (element) observer?.observe(element)
    window.addEventListener('resize', updateRect)
    window.addEventListener('load', updateRect)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (fallbackInterval) window.clearInterval(fallbackInterval)
      observer?.disconnect()
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('load', updateRect)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [current.targetId, updateRect, visible])

  const finish = () => {
    localStorage.setItem('elephante_tour_done', '1')
    onDone()
  }

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(value => value + 1)
      return
    }

    finish()
  }

  // Don't render until target element is found - avoids arbitrary fallback positioning
  if (!visible || (current.targetId && !targetRect)) return null

  const cardWidth = Math.min(320, window.innerWidth - 32)
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const gap = 18
  const activeRect = targetRect
  if (!activeRect) return null

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

  const highlightStyle: React.CSSProperties = {
    top: activeRect.top,
    left: activeRect.left,
    width: activeRect.width,
    height: activeRect.height,
    borderRadius: current.id === 'search' ? '28px' : '14px',
  }

  const cardTop = current.preferredPlacement === 'left'
    ? clamp(activeRect.top + activeRect.height / 2 - 88, 16, viewportHeight - 210)
    : clamp(activeRect.bottom + gap, 16, viewportHeight - 210)

  const cardLeft = current.preferredPlacement === 'left'
    ? clamp(activeRect.left - cardWidth - gap, 16, viewportWidth - cardWidth - 16)
    : clamp(activeRect.left + activeRect.width / 2 - cardWidth / 2, 16, viewportWidth - cardWidth - 16)

  const connectorStyle: React.CSSProperties = current.preferredPlacement === 'left'
    ? {
        top: activeRect.top + activeRect.height / 2 - 11,
        left: cardLeft + cardWidth + 4,
      }
    : {
        top: activeRect.bottom + 2,
        left: activeRect.left + activeRect.width / 2 - 11,
      }

  const connectorPath = current.preferredPlacement === 'left'
    ? <path d="M5 12h14M12 5l7 7-7 7" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    : <path d="M12 19V5M5 12l7-7 7 7" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-auto"
      style={{ cursor: 'pointer' }}
      onClick={next}
    >
      {targetRect && (
        <div
          className="absolute pointer-events-none"
          style={{
            ...highlightStyle,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
            border: '1.5px solid rgba(255,255,255,0.35)',
            animation: 'tour-pulse 2s ease-in-out infinite',
            transition: 'all 350ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      )}

      {targetRect && (
        <div className="absolute pointer-events-none" style={{ ...connectorStyle, zIndex: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            {connectorPath}
          </svg>
        </div>
      )}

      <div
        className="absolute pointer-events-auto animate-in fade-in duration-300"
        style={{
          top: cardTop,
          left: cardLeft,
          zIndex: 10,
          width: cardWidth,
          background: 'rgba(12,12,12,0.96)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '16px 18px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <p className="text-white text-[13px] font-semibold tracking-wide mb-1.5">{current.title}</p>
        <p className="text-zinc-400 text-[12px] leading-relaxed mb-4">{current.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, index) => (
              <span
                key={index}
                className="rounded-full transition-all duration-300"
                style={{
                  width: index === step ? '14px' : '5px',
                  height: '5px',
                  background: index === step ? 'white' : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={finish}
              className="text-zinc-600 text-[11px] hover:text-zinc-400 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={next}
              className="bg-white text-black text-[11px] font-bold px-4 py-1.5 rounded-full hover:bg-zinc-200 transition-colors"
            >
              {step < STEPS.length - 1 ? 'Next' : 'Done'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.75), 0 0 0 0 rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.75), 0 0 0 6px rgba(255,255,255,0.1); }
        }
      `}</style>
    </div>
  )
}
