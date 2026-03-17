'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

// ─── Glitch Placeholder ───────────────────────────────────────────────────────
const EN = 'What shall we dress you for today?'
const AR = 'بماذا نُلبسك اليوم؟'
const ARABIC_CHARS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'

function GlitchPlaceholder({ active }: { active: boolean }) {
  const [display, setDisplay] = useState(EN)
  const [glitching, setGlitching] = useState(false)
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (active) return // hide when user is typing

    let cancelled = false

    const scrambleTo = (target: string, onDone: () => void) => {
      const source = target === AR ? EN : AR
      let frame = 0
      const totalFrames = 18

      const tick = () => {
        if (cancelled) return
        frame++
        const progress = frame / totalFrames
        const result = target.split('').map((char, i) => {
          if (char === ' ') return ' '
          if (i / target.length < progress) return char
          // random glitch char
          const pool = target === AR ? 'ABCDEFGHIJabcdefghij' : ARABIC_CHARS
          return pool[Math.floor(Math.random() * pool.length)]
        }).join('')
        setDisplay(result)
        if (frame < totalFrames) {
          frameRef.current = setTimeout(tick, 45)
        } else {
          setDisplay(target)
          setGlitching(false)
          onDone()
        }
      }
      tick()
    }

    const cycle = () => {
      if (cancelled) return
      // wait 2.8s in English → glitch to Arabic → hold 2s → glitch back
      frameRef.current = setTimeout(() => {
        if (cancelled) return
        setGlitching(true)
        scrambleTo(AR, () => {
          frameRef.current = setTimeout(() => {
            if (cancelled) return
            setGlitching(true)
            scrambleTo(EN, () => {
              frameRef.current = setTimeout(cycle, 2800)
            })
          }, 2000)
        })
      }, 2800)
    }

    setDisplay(EN)
    cycle()
    return () => {
      cancelled = true
      if (frameRef.current) clearTimeout(frameRef.current)
    }
  }, [active])

  if (active) return null

  const isArabic = display === AR || (glitching && display.split('').some(c => ARABIC_CHARS.includes(c) && c !== ' '))

  return (
    <span
      className="absolute inset-x-4 top-1/2 -translate-y-1/2 pointer-events-none select-none text-zinc-600 text-base sm:text-sm text-center truncate"
      style={{
        fontFamily: isArabic ? "'Noto Naskh Arabic', serif" : 'inherit',
        letterSpacing: glitching ? '0.02em' : 'normal',
        textShadow: glitching ? '0 0 8px rgba(255,255,255,0.15)' : 'none',
        transition: 'text-shadow 0.1s',
      }}
    >
      {display}
    </span>
  )
}

// ─── Particle Background ──────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let W = 0, H = 0

    interface Particle {
      x: number; y: number
      vx: number; vy: number
      r: number; alpha: number
    }

    const COUNT = 55
    let particles: Particle[] = []

    const resize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }

    const init = () => {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.4,
        alpha: Math.random() * 0.45 + 0.1,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // subtle radial glow in centre
      const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55)
      grd.addColorStop(0, 'rgba(255,255,255,0.025)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, W, H)

      // connection lines
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 140) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(255,255,255,${0.055 * (1 - dist / 140)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // dots
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`
        ctx.fill()

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H
        if (p.y > H) p.y = 0
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    init()
    draw()
    window.addEventListener('resize', () => { resize(); init() })

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', () => { resize(); init() })
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: 'transparent' }}
    />
  )
}

// ─── Feed ─────────────────────────────────────────────────────────────────────
function FeedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams?.get('q') || '')
  const [isThinking, setIsThinking] = useState(false)
  const [aiStatus, setAiStatus] = useState('Listening...')
  const [displayName, setDisplayName] = useState<string>('User')

  const [recommendations, setRecommendations] = useState<any[]>([])
  const [allOutfits, setAllOutfits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // true = user has typed something (title should rise to top)
  const isSearching = searchQuery.length > 0

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (searchQuery) { params.set('q', searchQuery) } else { params.delete('q') }
      const newUrl = searchQuery ? `?${params.toString()}` : '/feed'
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchQuery])

  useEffect(() => {
    if (!searchQuery) { setIsThinking(false); return }
    setIsThinking(true)
    setAiStatus('Analyzing...')
    const timers = [
      setTimeout(() => setAiStatus('Curating looks...'), 600),
      setTimeout(() => setIsThinking(false), 1200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [searchQuery])

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const name = user.email?.split('@')[0] || 'Member'
      setDisplayName(name)

      const { data: savedItems } = await supabase
        .from('saved_outfits').select('outfits(style)').eq('user_id', user.id)

      const userStyles = savedItems?.map((item: any) => item?.outfits?.style).filter(Boolean) || []

      // Fetch both tables — excel_outfits (priority) + outfits
      const [{ data: excelOutfits }, { data: dbOutfits }] = await Promise.all([
        supabase.from('excel_outfits').select('*'),
        supabase.from('outfits').select('*'),
      ])

      const combined = [
        ...(excelOutfits || []).map((o: any) => ({ ...o, _source: 'excel' })),
        ...(dbOutfits    || []).map((o: any) => ({ ...o, _source: 'db'    })),
      ]

      setAllOutfits(combined)

      if (userStyles.length > 0) {
        const recs = combined.filter(o => userStyles.includes(o?.style) || userStyles.includes(o?.style_category))
        setRecommendations(recs.length > 0 ? recs : combined)
      } else {
        setRecommendations(combined)
      }
    } catch (error) {
      console.error('Elephante Data Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Loading Feed...</p>
      </div>
    )
  }

  const filteredOutfits = (allOutfits || []).filter(item => {
    if (!searchQuery) return true
    const queryParts = searchQuery.toLowerCase().trim().split(' ')
    // combine all searchable fields from both outfits and excel_outfits schemas
    const blob = [
      item?.style, item?.style_category, item?.outfit_name,
      item?.color_scheme, item?.color_palette,
      item?.top, item?.top_wear, item?.bottom, item?.bottom_wear,
      item?.shoes, item?.accessories, item?.outerwear,
      item?.occasions, item?.when_to_wear, item?.outfit_details,
      item?.material_notes, item?.brand, item?.pieces,
    ].filter(Boolean).join(' ').toLowerCase()

    const expanded = blob
      + (blob.includes('business') || blob.includes('meeting') ? ' office work corporate' : '')
      + (blob.includes('wedding') || blob.includes('formal event') ? ' gala party celebration' : '')
      + (blob.includes('thobe') ? ' thob dishdasha traditional saudi' : '')
      + (blob.includes('casual') ? ' relaxed weekend everyday' : '')

    return queryParts.every(part => expanded.includes(part))
  })

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-zinc-800 relative flex flex-col overflow-hidden">

      {/* ── Particle background ── */}
      <ParticleCanvas />

      {/* ── Closet icon (top-right, always) ── */}
      <button
        onClick={() => router.push('/closet')}
        className="fixed top-8 sm:top-10 right-4 sm:right-6 z-50 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 hover:text-white transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      </button>

      {/*
        ── TITLE BLOCK ──
        Default: absolutely centred (both axes).
        When searching: transition to top position (matching original layout).
      */}
      <div
        className={`
          fixed left-0 right-0 z-30 flex flex-col items-center
          transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${isSearching
            ? 'top-8 sm:top-10'          // ← risen to top (Apple-style)
            : 'top-1/2 -translate-y-1/2' // ← centred vertically
          }
        `}
      >
        <h1
          className={`
            font-bold tracking-[0.3em] sm:tracking-[0.4em] text-zinc-500 uppercase
            transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${isSearching ? 'text-[11px] sm:text-xs' : 'text-[15px] sm:text-base'}
          `}
        >
          Elephante AI
        </h1>

        {/* @username — hidden when searching */}
        <button
          onClick={() => router.push('/profile')}
          className={`
            group flex flex-col items-center mt-3
            transition-all duration-500
            ${isSearching ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100'}
          `}
        >
          <span className="text-zinc-500 text-[10px] sm:text-[9px] uppercase tracking-[0.2em] font-medium group-hover:text-white transition-colors">
            @{displayName}
          </span>
          <div className="h-[1px] w-0 bg-white group-hover:w-full transition-all duration-300" />
        </button>
      </div>

      {/* ── Search results (appear below the risen header) ── */}
      {isSearching && !isThinking && (
        <div className="relative z-20 flex-1 px-4 sm:px-6 pt-28 sm:pt-24 pb-36 sm:pb-32 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-zinc-500 text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest">Archive Results</h2>
            <div className="h-px bg-zinc-900 flex-1 ml-4" />
          </div>
          <div className="grid grid-cols-2 gap-y-4 sm:gap-y-6 gap-x-3 sm:gap-x-4">
            {filteredOutfits.map((outfit) => (
              <div
                key={outfit?.id}
                className="group cursor-pointer"
                onClick={() => router.push(`/outfit/${outfit?.id}`)}
              >
                <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-900">
                  <img
                    src={outfit?.image_url}
                    alt="Outfit"
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Thinking spinner ── */}
      {isSearching && isThinking && (
        <div className="relative z-20 flex flex-col items-center justify-center h-[50vh] space-y-4 mt-20">
          <div className="w-10 h-10 sm:w-8 sm:h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
          <p className="text-zinc-500 font-mono text-xs sm:text-[10px] uppercase tracking-widest">{aiStatus}</p>
        </div>
      )}

      {/* ── Search Bar (fixed bottom) ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent pt-10 pb-6 sm:pb-8 px-4 z-40">
        <div className="relative max-w-md mx-auto">
          <GlitchPlaceholder active={searchQuery.length > 0} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-white text-base sm:text-sm rounded-3xl py-4 sm:py-4 px-6 outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all duration-500 min-h-[56px] sm:min-h-0 placeholder-transparent text-center"
            style={searchQuery ? { boxShadow: '0 0 30px rgba(255,255,255,0.07)' } : {}}
            placeholder=" "
          />
          {isThinking && (
            <div className="absolute right-6 sm:right-5 top-1/2 -translate-y-1/2">
              <span className="flex h-2.5 w-2.5 sm:h-2 sm:w-2 relative">
                <span className="animate-ping absolute h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative rounded-full h-2.5 w-2.5 sm:h-2 sm:w-2 bg-white" />
              </span>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default function Feed() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <FeedContent />
    </Suspense>
  )
}