'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/lib/locale-context'

interface Step {
  id: string
  title: string
  titleAr: string
  description: string
  descriptionAr: string
  targetId: string
  preferredPlacement: 'bottom' | 'left'
}

const STEPS: Step[] = [
  {
    id: 'ai-stylist',
    title: 'Elephante AI',
    titleAr: 'Elephante AI',
    description: 'Your personal AI stylist. Tap to get curated outfit recommendations tailored to your unique style.',
    descriptionAr: 'منسّقك الذكي الشخصي. اضغط للحصول على اقتراحات إطلالات تناسب أسلوبك الفريد.',
    targetId: 'tour-ai-stylist',
    preferredPlacement: 'bottom',
  },
  {
    id: 'camera',
    title: 'Outfit Analyzer',
    titleAr: 'محلل الإطلالة',
    description: 'Upload a photo of your outfit to get instant ratings, styling tips, and color harmony analysis.',
    descriptionAr: 'ارفع صورة لإطلالتك للحصول على تقييم فوري، نصائح تنسيق، وتحليل لتناسق الألوان.',
    targetId: 'tour-camera',
    preferredPlacement: 'bottom',
  },
  {
    id: 'search',
    title: 'Smart Search',
    titleAr: 'البحث الذكي',
    description: 'Search for any outfit by occasion or vibe. Try "wedding guest" or "weekend casual".',
    descriptionAr: 'ابحث عن أي إطلالة حسب المناسبة أو الأجواء. جرّب "رسمي" أو "كاجوال".',
    targetId: 'tour-search',
    preferredPlacement: 'bottom',
  },
  {
    id: 'closet',
    title: 'Your Closet',
    titleAr: 'خزانتك',
    description: 'Manage your personal wardrobe archive, with every piece organized and easily accessible.',
    descriptionAr: 'أدِر أرشيف خزانتك الشخصية، مع تنظيم كل قطعة لتسهيل الوصول إليها.',
    targetId: 'tour-closet',
    preferredPlacement: 'bottom',
  },
  {
    id: 'profile',
    title: 'Style Profile',
    titleAr: 'الملف الشخصي',
    description: 'Customize your style preferences, skin tone, and body shape for highly personalized results.',
    descriptionAr: 'خصص تفضيلاتك للأناقة، ولون البشرة، وشكل الجسم للحصول على نتائج مخصصة جداً.',
    targetId: 'tour-profile',
    preferredPlacement: 'bottom',
  },
]

export default function IntroTour({ onDone }: { onDone: () => void }) {
  const { isAr } = useLocale()
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

  const isMobile = viewportWidth < 768
  const highlightStyle: React.CSSProperties = {
    top: activeRect.top,
    left: activeRect.left,
    width: activeRect.width,
    height: activeRect.height,
    borderRadius: current.id === 'search' || current.id === 'camera' ? '28px' : '14px',
  }


  // Smart placement logic
  let placement = current.preferredPlacement
  const spaceBelow = viewportHeight - activeRect.bottom
  const spaceAbove = activeRect.top
  const spaceLeft = activeRect.left
  const spaceRight = viewportWidth - activeRect.right

  if (spaceBelow < 220 && spaceAbove > spaceBelow) {
    placement = 'top'
  } else if (!isMobile && spaceRight > 350 && (current.id === 'closet' || current.id === 'camera')) {
    placement = 'right'
  } else if (!isMobile && spaceLeft > 350 && current.id === 'closet') {
    placement = 'left'
  }

  const cardTop = placement === 'top'
    ? clamp(activeRect.top - 180 - gap, 16, viewportHeight - 210)
    : clamp(activeRect.bottom + gap, 16, viewportHeight - 210)

  const cardLeft = placement === 'left'
    ? clamp(activeRect.left - cardWidth - gap, 16, viewportWidth - cardWidth - 16)
    : placement === 'right'
      ? clamp(activeRect.right + gap, 16, viewportWidth - cardWidth - 16)
      : clamp(activeRect.left + activeRect.width / 2 - cardWidth / 2, 16, viewportWidth - cardWidth - 16)

  const connectorStyle: React.CSSProperties = {
    top: placement === 'top' ? activeRect.top - 24 : placement === 'left' || placement === 'right' ? activeRect.top + activeRect.height / 2 - 11 : activeRect.bottom + 2,
    left: placement === 'left' ? cardLeft + cardWidth + 4 : placement === 'right' ? cardLeft - 26 : activeRect.left + activeRect.width / 2 - 11,
    transform: placement === 'top' ? 'rotate(180deg)' : placement === 'right' ? 'rotate(-90deg)' : placement === 'left' ? 'rotate(90deg)' : 'none',
  }

  const connectorPath = <path d="M12 19V5M5 12l7-7 7 7" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

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
          background: 'rgba(12,12,12,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '24px',
          padding: '20px 24px',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <p className="text-white text-[13px] font-semibold tracking-wide mb-1.5" dir={isAr ? 'rtl' : 'ltr'}>
          {isAr ? current.titleAr : current.title}
        </p>
        <p className="text-zinc-400 text-[12px] leading-relaxed mb-4" dir={isAr ? 'rtl' : 'ltr'}>
          {isAr ? current.descriptionAr : current.description}
        </p>
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
              {isAr ? 'تخطي' : 'Skip'}
            </button>
            <button
              onClick={next}
              className="bg-white text-black text-[11px] font-bold px-4 py-1.5 rounded-full hover:bg-zinc-200 transition-colors"
            >
              {step < STEPS.length - 1 ? (isAr ? 'التالي' : 'Next') : (isAr ? 'تم' : 'Done')}
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
