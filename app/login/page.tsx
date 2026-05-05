'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ParticleCanvas from '@/components/ParticleCanvas'

// ─── Translations ─────────────────────────────────────────────────────────────
const T = {
  en: {
    tagline: 'Your personal stylist, curated for you.',
    hint: 'touch to begin',
    email: 'Email Address',
    password: 'Password',
    enter: 'Enter',
    logging: 'Logging in...',
    noAccount: "Don't have an account?",
    register: 'Register',
  },
  ar: {
    tagline: 'مُصمِّمك الشخصي، مُختار لك.',
    hint: 'المس للبدء',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    enter: 'دخول',
    logging: 'جارٍ تسجيل الدخول...',
    noAccount: 'ليس لديك حساب؟',
    register: 'سجّل',
  },
}


function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M2.25 12s3.5-6.25 9.75-6.25S21.75 12 21.75 12 18.25 18.25 12 18.25 2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="2.75" />
      {hidden && <path d="M4 4l16 16" />}
    </svg>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────
export default function Login() {
  const router = useRouter()
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [lang, setLang]               = useState<'en' | 'ar'>('en')
  const [showPassword, setShowPassword] = useState(false)
  const touched = true
  const formVisible = true

  useEffect(() => {
    const stored = localStorage.getItem('elephante_lang')
    if (stored === 'ar' || stored === 'en') setLang(stored)
  }, [])

  const t    = T[lang]
  const isAr = lang === 'ar'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/feed')
  }

  return (
    <div
      className="min-h-[100dvh] bg-black text-white relative"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <ParticleCanvas />

      {/* ── Single centred column — everything lives here ── */}
      <div className="relative z-10 min-h-[100dvh] flex items-center justify-center px-4 py-12 overflow-y-auto">
        <div className="w-full max-w-sm flex flex-col items-center">

          {/* ── Brand block ── */}
          <div
            className={`
              relative flex flex-col items-center w-full
              transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
              ${touched ? 'mb-10' : 'mb-0'}
            `}
          >
            {/* Breathing ambient glow — untouched only */}
            <div
              className="absolute pointer-events-none"
              style={{
                opacity: touched ? 0 : 1,
                filter: 'blur(70px)',
                background: 'radial-gradient(ellipse, rgba(255,255,255,0.13) 0%, transparent 70%)',
                width: '340px',
                height: '200px',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                animation: 'breathe 3s ease-in-out infinite',
                transition: 'opacity 0.6s',
              }}
            />

            {/* ELEPHANTE text — visible only when untouched, fades + scales out */}
            <h1
              className="relative font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em] text-zinc-300"
              style={{
                fontSize: '15px',
                textShadow: '0 0 40px rgba(255,255,255,0.28), 0 0 80px rgba(255,255,255,0.1)',
                opacity: touched ? 0 : 1,
                transform: touched ? 'scale(0.85) translateY(-6px)' : 'scale(1) translateY(0)',
                transition: 'opacity 0.4s ease, transform 0.4s ease, text-shadow 0.4s',
                pointerEvents: touched ? 'none' : 'auto',
                height: touched ? 0 : 'auto',
                overflow: 'hidden',
              }}
            >
              Elephante
            </h1>

            {/* Logo — hidden when untouched, grows in as text fades out */}
            <img
              src="/logo.png.png"
              alt="Elephante"
              style={{
                filter: 'invert(1)',
                opacity: touched ? 1 : 0,
                transform: touched ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(10px)',
                transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
                width: touched ? '96px' : '0px',
                height: touched ? '96px' : '0px',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
            />

            {/* Tagline + hint — collapse on touch */}
            <p
              className="relative mt-2 text-xs tracking-wide text-center px-4 transition-all duration-400"
              style={{
                color: 'rgba(255,255,255,0.22)',
                fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit',
                textShadow: '0 0 24px rgba(255,255,255,0.18)',
                opacity: touched ? 0 : 1,
                height: touched ? 0 : 'auto',
                overflow: 'hidden',
                marginTop: touched ? 0 : undefined,
                pointerEvents: touched ? 'none' : 'auto',
                transition: 'opacity 0.3s, height 0.3s',
              }}
            >
              {t.tagline}
            </p>

            <span
              className="relative text-[10px] uppercase tracking-[0.3em] text-zinc-700"
              style={{
                animation: 'hintPulse 2.6s ease-in-out infinite',
                opacity: touched ? 0 : 1,
                height: touched ? 0 : 'auto',
                overflow: 'hidden',
                marginTop: touched ? 0 : '28px',
                display: 'block',
                pointerEvents: touched ? 'none' : 'auto',
                transition: 'opacity 0.3s, height 0.3s, margin-top 0.3s',
              }}
            >
              {t.hint}
            </span>
          </div>

          {/* ── Form — fades in below brand ── */}
          <div
            className={`
              w-full
              transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
              ${formVisible
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden'}
            `}
          >
            <form onSubmit={handleLogin}>
              <div className={`space-y-3 transition-opacity duration-300 ${loading ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>

                <input
                  type="email"
                  placeholder={t.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="email"
                  style={{
                    boxShadow: email && !loading ? '0 0 30px rgba(255,255,255,0.08)' : 'none',
                    fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit',
                    textAlign: isAr ? 'right' : 'left',
                  }}
                  className="w-full px-4 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl outline-none transition-all duration-300 text-white placeholder-zinc-600 focus:border-white/40 focus:ring-2 focus:ring-white/20 text-sm"
                />

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t.password}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="current-password"
                    style={{
                      boxShadow: password && !loading ? '0 0 30px rgba(255,255,255,0.08)' : 'none',
                      fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit',
                      textAlign: isAr ? 'right' : 'left',
                    }}
                    className={`w-full px-4 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl outline-none transition-all duration-300 text-white placeholder-zinc-600 focus:border-white/40 focus:ring-2 focus:ring-white/20 text-sm ${
                      isAr ? 'pl-11' : 'pr-11'
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((value) => !value)}
                    className={`absolute top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-300 disabled:pointer-events-none ${
                      isAr ? 'left-3' : 'right-3'
                    }`}
                  >
                    <EyeIcon hidden={showPassword} />
                  </button>
                </div>

                {error && (
                  <p
                    className="text-red-400 text-xs pt-0.5"
                    style={{ fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit' }}
                  >
                    {error}
                  </p>
                )}
              </div>

              {!loading && (
                <button
                  type="submit"
                  className="w-full bg-white text-black font-bold text-sm py-3.5 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 mt-4 tracking-wide min-h-[52px]"
                  style={{ fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit' }}
                >
                  {t.enter}
                </button>
              )}
            </form>

            {/* Loading state */}
            {loading && (
              <div className="flex flex-col items-center justify-center mt-6 space-y-3">
                <div className="relative w-10 h-10 overflow-hidden">
                  <img src="/logo.png.png" alt="Logo" className="w-full h-full object-contain opacity-20" style={{ filter: 'invert(1)' }} />
                  <div className="absolute inset-0 overflow-hidden">
                    <img src="/logo.png.png" alt="Logo filling" className="w-full h-full object-contain logo-fill" style={{ filter: 'invert(1)' }} />
                  </div>
                </div>
                <p
                  className="text-zinc-400 text-sm"
                  style={{ fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit' }}
                >
                  {t.logging}
                </p>
              </div>
            )}

            <p
              className="text-center text-zinc-600 text-xs mt-6"
              style={{ fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit' }}
            >
              {t.noAccount}{' '}
              <Link href="/register" className="text-zinc-400 hover:text-white underline transition-colors">
                {t.register}
              </Link>
            </p>
          </div>

        </div>
      </div>

      <style jsx>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.6; transform: translateY(-10px) scale(1); }
          50%       { opacity: 1;   transform: translateY(-10px) scale(1.15); }
        }
        @keyframes hintPulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.85; }
        }
        @keyframes fillUp {
          0%   { clip-path: inset(100% 0 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        .logo-fill { animation: fillUp 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
