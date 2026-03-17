'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

// ─── Profile ──────────────────────────────────────────────────────────────────
export default function ProfileDashboard() {
  const router = useRouter()
  const [loading, setLoading]     = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [username, setUsername]   = useState('Style Icon')
  const [styleBio, setStyleBio]   = useState('')
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('style_bio, id')
        .eq('id', user.id)
        .single()

      if (profile) setStyleBio(profile.style_bio || 'I want to dress effortlessly chic and modern.')

      const { count } = await supabase
        .from('saved_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setSavedCount(count || 0)
      setLoading(false)
    }
    fetchData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <ParticleCanvas />
        <div className="relative z-10 w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
        <p className="relative z-10 text-zinc-600 text-[10px] uppercase tracking-widest">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <ParticleCanvas />

      {/* ── Back button ── */}
      <div className="fixed top-0 left-0 right-0 z-20 px-5 pt-8 sm:pt-10 flex justify-between items-center">
        <button
          onClick={() => router.push('/feed')}
          className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors min-h-[44px] flex items-center"
        >
          Back
        </button>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-20">
        <div className="w-full max-w-sm flex flex-col items-center">

          {/* Avatar */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-2xl mb-5 shadow-[0_0_24px_rgba(255,255,255,0.04)]">
            <span className="text-zinc-300 text-2xl font-light">
              {userEmail.charAt(0).toUpperCase()}
            </span>
          </div>

          <h1 className="text-base font-light tracking-widest text-white mb-1">{username}</h1>
          <p className="text-zinc-600 text-[11px] tracking-wide mb-10">{userEmail}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 w-full mb-8">
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl text-center">
              <div className="text-2xl font-bold text-white mb-1">{savedCount}</div>
              <div className="text-[9px] uppercase tracking-widest text-zinc-600">Saved Items</div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl text-center flex flex-col items-center justify-center">
              <span className="text-2xl mb-1">🔥</span>
              <div className="text-[9px] uppercase tracking-widest text-zinc-600">Streak</div>
            </div>
          </div>

          {/* Style note */}
          <div className="w-full bg-zinc-900/30 border border-zinc-800/60 p-5 rounded-2xl mb-8">
            <h3 className="text-[9px] uppercase tracking-widest text-zinc-600 mb-3">My Style Goal</h3>
            <p className="text-sm text-zinc-400 leading-relaxed italic">"{styleBio}"</p>
          </div>

          {/* Actions */}
          <div className="w-full space-y-3">
            <button
              onClick={() => router.push('/profile/preferences')}
              className="w-full py-3.5 bg-white text-black font-bold text-[10px] uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-colors min-h-[52px]"
            >
              Personal Preferences
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
              className="w-full py-3.5 border border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest rounded-full hover:border-red-900/60 hover:text-red-500 transition-colors min-h-[52px]"
            >
              Sign Out
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}