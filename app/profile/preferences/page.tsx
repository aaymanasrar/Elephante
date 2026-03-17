'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Data ─────────────────────────────────────────────────────────────────────
const SKIN_TONES = [
  { id: 'light',  color: '#FFE0BD', label: 'Light'  },
  { id: 'medium', color: '#D2B48C', label: 'Medium' },
  { id: 'tan',    color: '#AF8154', label: 'Tan'    },
  { id: 'dark',   color: '#5C3816', label: 'Deep'   },
]

const HEIGHTS = [
  { id: 'short',   label: 'Short',   sub: "Under 5'7\""    },
  { id: 'average', label: 'Average', sub: "5'7\" – 6'0\""  },
  { id: 'tall',    label: 'Tall',    sub: "Over 6'0\""     },
]

const BODY_SHAPES = [
  { id: 'slim',     label: 'Slim',     sub: 'Lean build' },
  { id: 'athletic', label: 'Athletic', sub: 'Toned'      },
  { id: 'average',  label: 'Average',  sub: 'Medium'     },
  { id: 'stocky',   label: 'Stocky',   sub: 'Solid'      },
  { id: 'heavy',    label: 'Heavy',    sub: 'Large'      },
]

const COLOR_PALETTES = [
  { id: 'neutral',  label: 'Neutral',      colors: ['#F5F5DC', '#D3D3D3', '#FFFFFF', '#8B7355'] },
  { id: 'dark',     label: 'Dark / Moody', colors: ['#000000', '#2F4F4F', '#000080', '#363636'] },
  { id: 'pastel',   label: 'Soft / Pastel',colors: ['#FFB6C1', '#ADD8E6', '#E6E6FA', '#FFE4E1'] },
  { id: 'colorful', label: 'Vibrant',      colors: ['#FF4500', '#32CD32', '#FFD700', '#4169E1'] },
]

const OCCASIONS = [
  { id: 'Business Casual', label: 'Business Casual' },
  { id: 'Smart Casual',    label: 'Smart Casual'    },
  { id: 'Traditional',     label: 'Traditional'     },
  { id: 'Formal',          label: 'Formal'          },
  { id: 'Streetwear',      label: 'Streetwear'      },
]

// ─── Particle Canvas ──────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let W = 0, H = 0

    interface Particle { x: number; y: number; vx: number; vy: number; r: number; alpha: number }
    const COUNT = 55
    let particles: Particle[] = []

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    const init   = () => {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.4, alpha: Math.random() * 0.45 + 0.1,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55)
      grd.addColorStop(0, 'rgba(255,255,255,0.025)'); grd.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H)

      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 140) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(255,255,255,${0.055 * (1 - dist / 140)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`; ctx.fill()
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
      }
      animId = requestAnimationFrame(draw)
    }

    resize(); init(); draw()
    const onResize = () => { resize(); init() }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize) }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />
}

// ─── Preferences ──────────────────────────────────────────────────────────────
export default function Preferences() {
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [skinTone, setSkinTone] = useState('')
  const [height, setHeight]     = useState('')
  const [bodyShape, setBodyShape]   = useState('')
  const [styleBio, setStyleBio]     = useState('')
  const [selectedPalettes, setSelectedPalettes]   = useState<string[]>([])
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([])

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setSkinTone(data.skin_tone || '')
        setHeight(data.height_category || '')
        setBodyShape(data.body_shape || '')
        setStyleBio(data.style_bio || '')
        setSelectedPalettes(data.preferred_palette ? data.preferred_palette.split(', ') : [])
        setSelectedOccasions(data.selected_occasions || [])
      }
      setLoading(false)
    }
    loadProfile()
  }, [router])

  const togglePalette  = (id: string) => setSelectedPalettes(prev  => prev.includes(id)  ? prev.filter(x => x !== id)  : [...prev, id])
  const toggleOccasion = (id: string) => setSelectedOccasions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        skin_tone: skinTone,
        height_category: height,
        body_shape: bodyShape,
        style_bio: styleBio,
        preferred_palette: selectedPalettes.join(', '),
        selected_occasions: selectedOccasions,
        updated_at: new Date().toISOString(),
      })
      router.push('/profile')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <ParticleCanvas />
        <div className="relative z-10 w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
        <p className="relative z-10 text-zinc-600 text-[10px] uppercase tracking-widest">Loading...</p>
      </div>
    )
  }

  // shared class strings
  const sectionTitle = "text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-5"
  const cardBase = "p-3 rounded-xl border text-center transition-all duration-300 text-xs font-semibold uppercase tracking-wider"
  const cardOn   = "bg-white text-black border-white"
  const cardOff  = "bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300"

  return (
    <div className="min-h-screen bg-black text-white relative">
      <ParticleCanvas />

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-sm border-b border-zinc-900 px-5 py-4 flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors min-h-[44px] flex items-center"
        >
          Cancel
        </button>
        <h1 className="text-[11px] font-bold tracking-[0.3em] uppercase text-zinc-400">
          Preferences
        </h1>
        <div className="w-14" />
      </div>

      {/* ── Scrollable content ── */}
      <div className="relative z-10 max-w-sm mx-auto px-5 py-10 pb-36 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Skin Tone */}
        <section>
          <p className={sectionTitle}>Skin Tone</p>
          <div className="flex justify-between px-1">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone.id}
                onClick={() => setSkinTone(tone.id)}
                className="flex flex-col items-center gap-2.5 group outline-none"
              >
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 ${
                    skinTone === tone.id
                      ? 'ring-2 ring-white ring-offset-4 ring-offset-black scale-110 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                      : 'opacity-40 group-hover:opacity-90 group-hover:scale-105'
                  }`}
                  style={{ backgroundColor: tone.color }}
                />
                <span className={`text-[9px] uppercase tracking-widest transition-colors ${
                  skinTone === tone.id ? 'text-white' : 'text-zinc-700 group-hover:text-zinc-400'
                }`}>
                  {tone.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Height */}
        <section>
          <p className={sectionTitle}>Height</p>
          <div className="grid grid-cols-3 gap-2.5">
            {HEIGHTS.map((h) => (
              <button
                key={h.id}
                onClick={() => setHeight(h.id)}
                className={`${cardBase} ${height === h.id ? cardOn : cardOff}`}
              >
                <div className="font-bold text-[11px]">{h.label}</div>
                <div className="text-[9px] opacity-60 mt-0.5">{h.sub}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Body Shape */}
        <section>
          <p className={sectionTitle}>Body Shape</p>
          <div className="grid grid-cols-3 gap-2.5">
            {BODY_SHAPES.map((b) => (
              <button
                key={b.id}
                onClick={() => setBodyShape(b.id)}
                className={`${cardBase} ${bodyShape === b.id ? cardOn : cardOff}`}
              >
                <div className="font-bold text-[11px]">{b.label}</div>
                <div className="text-[9px] opacity-60 mt-0.5">{b.sub}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Aesthetics */}
        <section>
          <p className={sectionTitle}>Aesthetics</p>
          <div className="flex flex-col gap-2.5">
            {COLOR_PALETTES.map((p) => {
              const isSelected = selectedPalettes.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => togglePalette(p.id)}
                  className={`w-full px-4 py-3.5 rounded-xl border flex justify-between items-center transition-all duration-300 ${
                    isSelected
                      ? 'bg-zinc-900 border-white/30 shadow-[0_0_14px_rgba(255,255,255,0.06)]'
                      : 'bg-zinc-950 border-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <span className={`text-[11px] uppercase tracking-[0.18em] ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                    {p.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {p.colors.map((c, i) => (
                        <div key={i} className="w-5 h-5 rounded-full border-2 border-black" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 border-black flex items-center justify-center transition-all duration-300 ${
                      isSelected ? 'bg-white opacity-100 scale-100' : 'bg-transparent opacity-0 scale-75'
                    }`}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Occasions */}
        <section>
          <p className={sectionTitle}>Lifestyle</p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((occ) => {
              const isSelected = selectedOccasions.includes(occ.id)
              return (
                <button
                  key={occ.id}
                  onClick={() => toggleOccasion(occ.id)}
                  className={`px-4 py-2 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 min-h-[40px] ${
                    isSelected
                      ? 'bg-white text-black border-white shadow-[0_0_14px_rgba(255,255,255,0.2)]'
                      : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {occ.label}
                </button>
              )
            })}
          </div>
        </section>

        {/* Style Goal */}
        <section>
          <p className={sectionTitle}>Style Goal</p>
          <p className="text-zinc-700 text-[11px] mb-3">How do you want to present yourself?</p>
          <textarea
            value={styleBio}
            onChange={(e) => setStyleBio(e.target.value)}
            placeholder="E.g. I want to look professional but approachable..."
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all h-32 resize-none"
          />
        </section>

      </div>

      {/* ── Save button ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black to-transparent pt-10 pb-6 px-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full max-w-sm mx-auto flex items-center justify-center h-12 bg-white text-black rounded-full font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-40"
        >
          {saving ? 'Updating...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}