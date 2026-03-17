'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Translations ─────────────────────────────────────────────────────────────
const T = {
  en: {
    fullName: 'Full Name',
    username: 'Username',
    email: 'Email Address',
    password: 'Password',
    register: 'Register',
    creating: 'Creating account...',
    usernameTaken: 'Username is already in use',
    usernameAvailable: 'Username is available',
    emailTaken: 'Email is already in use',
    emailAvailable: 'Email is available',
    haveAccount: 'Already have an account?',
    login: 'Log in',
  },
  ar: {
    fullName: 'الاسم الكامل',
    username: 'اسم المستخدم',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    register: 'إنشاء حساب',
    creating: 'جارٍ إنشاء الحساب...',
    usernameTaken: 'اسم المستخدم مستخدم بالفعل',
    usernameAvailable: 'اسم المستخدم متاح',
    emailTaken: 'البريد الإلكتروني مستخدم بالفعل',
    emailAvailable: 'البريد الإلكتروني متاح',
    haveAccount: 'لديك حساب بالفعل؟',
    login: 'تسجيل الدخول',
  },
}

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
      const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55)
      grd.addColorStop(0, 'rgba(255,255,255,0.025)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, W, H)

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

      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`
        ctx.fill()
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

// ─── Register ─────────────────────────────────────────────────────────────────
export default function Register() {
  const [fullName, setFullName]       = useState('')
  const [username, setUsername]       = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [emailStatus, setEmailStatus] = useState<'checking' | 'available' | 'taken' | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | null>(null)
  const [lang, setLang]               = useState<'en' | 'ar'>('en')
  const router = useRouter()

  useEffect(() => {
    const locale = (navigator.language || 'en').toLowerCase()
    if (locale.startsWith('ar')) setLang('ar')
  }, [])

  // Check email
  useEffect(() => {
    if (!email || email.length < 3 || !email.includes('@')) { setEmailStatus(null); return }
    const check = async () => {
      setEmailStatus('checking')
      try {
        const { data } = await supabase.from('profiles').select('email').eq('email', email).maybeSingle()
        setEmailStatus(data?.email ? 'taken' : 'available')
      } catch { setEmailStatus(null) }
    }
    const timer = setTimeout(check, 600)
    return () => clearTimeout(timer)
  }, [email])

  // Check username
  useEffect(() => {
    if (!username || username.length < 2) { setUsernameStatus(null); return }
    const check = async () => {
      setUsernameStatus('checking')
      try {
        const { data } = await supabase.from('profiles').select('username').eq('username', username.toLowerCase()).maybeSingle()
        setUsernameStatus(data?.username ? 'taken' : 'available')
      } catch { setUsernameStatus(null) }
    }
    const timer = setTimeout(check, 600)
    return () => clearTimeout(timer)
  }, [username])

  const t    = T[lang]
  const isAr = lang === 'ar'

  const handleRegister = async () => {
    if (!fullName || !username || !email || !password) return
    if (emailStatus === 'taken' || usernameStatus === 'taken') return
    if (password.length < 6) return

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, username: username.toLowerCase() } },
    })

    if (error) {
      if (error.message.includes('already registered')) setEmailStatus('taken')
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        username: username.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
    }

    router.push('/onboarding')
    setLoading(false)
  }

  // Glow helpers
  const statusGlow = (status: typeof emailStatus) => {
    if (status === 'taken')     return '0 0 24px rgba(239,68,68,0.5)'
    if (status === 'available') return '0 0 24px rgba(34,197,94,0.4)'
    return 'none'
  }
  const statusBorder = (status: typeof emailStatus) => {
    if (status === 'taken')     return 'border-red-500/60'
    if (status === 'available') return 'border-green-500/60'
    return 'border-zinc-800'
  }

  const inputBase = `w-full px-4 py-3.5 bg-zinc-900 border rounded-xl outline-none transition-all duration-300 text-white placeholder-zinc-600 focus:border-white/40 focus:ring-2 focus:ring-white/20 text-sm min-h-[52px]`
  const arabicFont = isAr ? "'Noto Naskh Arabic', serif" : 'inherit'

  return (
    <div
      className="min-h-screen bg-black text-white relative overflow-hidden"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <ParticleCanvas />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm flex flex-col items-center">

          {/* ── Brand ── */}
          <div className="flex flex-col items-center mb-10">
            <h1
              className="font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em] text-zinc-500"
              style={{ fontSize: '13px' }}
            >
              Elephante
            </h1>
            <img
              src="/logo.png.png"
              alt="Elephante"
              className="mt-3 object-contain"
              style={{
                width: '72px',
                height: '72px',
                filter: 'invert(1)',
                opacity: 0.85,
              }}
            />
          </div>

          {/* ── Fields ── */}
          <div className={`w-full space-y-3 transition-opacity duration-300 ${loading ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>

            {/* Full Name */}
            <input
              type="text"
              placeholder={t.fullName}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              autoComplete="name"
              style={{
                boxShadow: fullName && !loading ? '0 0 24px rgba(255,255,255,0.07)' : 'none',
                fontFamily: arabicFont,
                textAlign: isAr ? 'right' : 'left',
              }}
              className={`${inputBase} border-zinc-800`}
            />

            {/* Username */}
            <div>
              <input
                type="text"
                placeholder={t.username}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
                style={{
                  boxShadow: !loading ? statusGlow(usernameStatus) : 'none',
                  fontFamily: arabicFont,
                  textAlign: isAr ? 'right' : 'left',
                }}
                className={`${inputBase} ${statusBorder(usernameStatus)}`}
              />
              {usernameStatus === 'taken' && !loading && (
                <p className="text-red-400 text-[11px] mt-1.5 px-1" style={{ fontFamily: arabicFont }}>{t.usernameTaken}</p>
              )}
              {usernameStatus === 'available' && !loading && (
                <p className="text-green-400 text-[11px] mt-1.5 px-1" style={{ fontFamily: arabicFont }}>{t.usernameAvailable}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <input
                type="email"
                placeholder={t.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                style={{
                  boxShadow: !loading ? statusGlow(emailStatus) : 'none',
                  fontFamily: arabicFont,
                  textAlign: isAr ? 'right' : 'left',
                }}
                className={`${inputBase} ${statusBorder(emailStatus)}`}
              />
              {emailStatus === 'taken' && !loading && (
                <p className="text-red-400 text-[11px] mt-1.5 px-1" style={{ fontFamily: arabicFont }}>{t.emailTaken}</p>
              )}
              {emailStatus === 'available' && !loading && (
                <p className="text-green-400 text-[11px] mt-1.5 px-1" style={{ fontFamily: arabicFont }}>{t.emailAvailable}</p>
              )}
            </div>

            {/* Password */}
            <input
              type="password"
              placeholder={t.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              style={{
                boxShadow: password && !loading ? '0 0 24px rgba(255,255,255,0.07)' : 'none',
                fontFamily: arabicFont,
                textAlign: isAr ? 'right' : 'left',
              }}
              className={`${inputBase} border-zinc-800`}
            />
          </div>

          {/* ── Register button ── */}
          {!loading && (
            <button
              onClick={handleRegister}
              disabled={emailStatus === 'taken' || usernameStatus === 'taken' || !fullName || !username || !email || !password}
              className="w-full bg-white text-black font-bold text-sm py-3.5 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed mt-5 tracking-wide min-h-[52px]"
              style={{ fontFamily: arabicFont }}
            >
              {t.register}
            </button>
          )}

          {/* ── Loading ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center mt-8 space-y-3">
              <div className="relative w-10 h-10 overflow-hidden">
                <img src="/logo.png.png" alt="Logo" className="w-full h-full object-contain opacity-20" style={{ filter: 'invert(1)' }} />
                <div className="absolute inset-0 overflow-hidden">
                  <img src="/logo.png.png" alt="Logo filling" className="w-full h-full object-contain logo-fill" style={{ filter: 'invert(1)' }} />
                </div>
              </div>
              <p className="text-zinc-400 text-sm" style={{ fontFamily: arabicFont }}>{t.creating}</p>
            </div>
          )}

          {/* ── Login link ── */}
          <p className="text-center text-zinc-600 text-xs mt-6" style={{ fontFamily: arabicFont }}>
            {t.haveAccount}{' '}
            <Link href="/login" className="text-zinc-400 hover:text-white underline transition-colors">
              {t.login}
            </Link>
          </p>

        </div>
      </div>

      <style jsx>{`
        @keyframes fillUp {
          0%   { clip-path: inset(100% 0 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        .logo-fill { animation: fillUp 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  )
}