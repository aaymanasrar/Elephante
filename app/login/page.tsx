'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ParticleCanvas from '@/components/ParticleCanvas'
import { useLocale } from '@/lib/locale-context'

const T = {
  en: {
    tagline: 'Your personal stylist, curated for you.',
    hint: 'touch to begin',
    username: 'Username',
    password: 'Password',
    enter: 'Enter',
    logging: 'Logging in...',
    noAccount: "Don't have an account?",
    register: 'Register',
  },
  ar: {
    tagline: 'مُصمِّمك الشخصي، مُختار لك.',
    hint: 'المس للبدء',
    username: 'اسم المستخدم',
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

export default function Login() {
  const router = useRouter()
  const { lang, isAr } = useLocale()
  const [username, setUsername]         = useState('')
  const [password, setPassword]         = useState('')
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const t = T[lang]
  const arabicFont = isAr ? "'Noto Naskh Arabic', serif" : 'inherit'
  const invalidLoginMessage = lang === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.session?.access_token || !data?.session?.refresh_token) {
        setError(invalidLoginMessage)
        setLoading(false)
        return
      }

      const { error: sessionError } = await supabase.auth.setSession(data.session)
      if (sessionError) throw sessionError

      router.push('/feed')
    } catch {
      setError(lang === 'ar' ? 'تعذّر تسجيل الدخول. حاول مرة أخرى.' : 'Could not log in. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white relative" dir={isAr ? 'rtl' : 'ltr'}>
      <ParticleCanvas />

      <div className="relative z-10 min-h-[100dvh] flex items-center justify-center px-4 py-12 overflow-y-auto">
        <div className="w-full max-w-sm flex flex-col items-center">

          {/* Brand */}
          <div className="flex flex-col items-center mb-10">
            <img
              src="/logo.png.png"
              alt="Elephante"
              style={{ width: '80px', height: '80px', filter: 'invert(1)', opacity: 0.9, objectFit: 'contain' }}
            />
            <p
              className="mt-3 text-xs tracking-wide text-center"
              style={{ color: 'rgba(255,255,255,0.22)', fontFamily: arabicFont }}
            >
              {t.tagline}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="w-full">
            <div className={`space-y-3 transition-opacity duration-300 ${loading ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>

              {/* Username */}
              <input
                type="text"
                placeholder={t.username}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
                autoComplete="username"
                style={{
                  boxShadow: username && !loading ? '0 0 30px rgba(255,255,255,0.08)' : 'none',
                  fontFamily: arabicFont,
                  textAlign: isAr ? 'right' : 'left',
                }}
                className="w-full px-4 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl outline-none transition-all duration-300 text-white placeholder-zinc-600 focus:border-white/40 focus:ring-2 focus:ring-white/20 text-sm min-h-[52px]"
              />

              {/* Password */}
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
                    fontFamily: arabicFont,
                    textAlign: isAr ? 'right' : 'left',
                  }}
                  className={`w-full px-4 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl outline-none transition-all duration-300 text-white placeholder-zinc-600 focus:border-white/40 focus:ring-2 focus:ring-white/20 text-sm min-h-[52px] ${isAr ? 'pl-11' : 'pr-11'}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className={`absolute top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-300 disabled:pointer-events-none ${isAr ? 'left-3' : 'right-3'}`}
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-xs pt-0.5" style={{ fontFamily: arabicFont }}>
                  {error}
                </p>
              )}
            </div>

            {/* Submit / Loading */}
            {loading ? (
              <div className="flex flex-col items-center justify-center mt-6 space-y-3">
                <div className="relative w-10 h-10 overflow-hidden">
                  <img src="/logo.png.png" alt="" className="w-full h-full object-contain opacity-20" style={{ filter: 'invert(1)' }} aria-hidden="true" />
                  <div className="absolute inset-0 overflow-hidden">
                    <img src="/logo.png.png" alt="" className="w-full h-full object-contain logo-fill" style={{ filter: 'invert(1)' }} aria-hidden="true" />
                  </div>
                </div>
                <p className="text-zinc-400 text-sm" style={{ fontFamily: arabicFont }}>{t.logging}</p>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!username.trim() || !password}
                className="w-full bg-white text-black font-bold text-sm py-3.5 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed mt-4 tracking-wide min-h-[52px]"
                style={{ fontFamily: arabicFont }}
              >
                {t.enter}
              </button>
            )}
          </form>

          <p className="text-center text-zinc-600 text-xs mt-6" style={{ fontFamily: arabicFont }}>
            {t.noAccount}{' '}
            <Link href="/register" className="text-zinc-400 hover:text-white underline transition-colors">
              {t.register}
            </Link>
          </p>

          <p className="text-center mt-6">
            <Link href="/privacy" className="text-zinc-700 hover:text-zinc-500 text-[10px] tracking-widest uppercase transition-colors">
              {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
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
