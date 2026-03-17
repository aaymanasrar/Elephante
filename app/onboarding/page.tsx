'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Data ─────────────────────────────────────────────────────────────────────
const SKIN_TONES = [
  { id: 'light',  color: '#FFE0BD', label: 'Light',  labelAr: 'فاتح' },
  { id: 'medium', color: '#D2B48C', label: 'Medium', labelAr: 'متوسط' },
  { id: 'tan',    color: '#AF8154', label: 'Tan',    labelAr: 'أسمر' },
  { id: 'dark',   color: '#5C3816', label: 'Deep',   labelAr: 'داكن' },
]

const COLOR_PALETTES = [
  { id: 'neutral',  label: 'Neutral',  labelAr: 'محايد',  colors: ['#F5F5DC', '#D3D3D3', '#FFFFFF', '#8B7355'] },
  { id: 'dark',     label: 'Dark',     labelAr: 'داكن',   colors: ['#1A1A1A', '#2F4F4F', '#000080', '#363636'] },
  { id: 'pastel',   label: 'Pastel',   labelAr: 'باستيل', colors: ['#FFB6C1', '#ADD8E6', '#E6E6FA', '#FFE4E1'] },
  { id: 'colorful', label: 'Vibrant',  labelAr: 'زاهي',   colors: ['#FF4500', '#32CD32', '#FFD700', '#4169E1'] },
]

const OCCASION_STYLES = [
  { id: 'Business Casual', label: 'Business Casual',     labelAr: 'كاجوال أعمال' },
  { id: 'Smart Casual',    label: 'Smart Casual',        labelAr: 'كاجوال أنيق' },
  { id: 'Traditional',     label: 'Traditional / Wedding', labelAr: 'تقليدي / أعراس' },
  { id: 'Formal',          label: 'Formal / Black Tie',  labelAr: 'رسمي / بلاك تاي' },
  { id: 'Streetwear',      label: 'Streetwear Luxury',   labelAr: 'ستريتوير فاخر' },
]

const T = {
  en: {
    step1Title: 'Skin Tone',
    step1Sub: 'Select closest match',
    step2Title: 'Aesthetic',
    step2Sub: 'Select all that apply',
    step3Title: 'Lifestyle',
    step3Sub: 'Select your style vibe',
    back: 'Back',
    next: 'Next',
    finish: 'Finish',
    saving: 'Saving...',
  },
  ar: {
    step1Title: 'لون البشرة',
    step1Sub: 'اختر الأقرب لبشرتك',
    step2Title: 'الذوق',
    step2Sub: 'اختر ما يناسبك',
    step3Title: 'نمط الحياة',
    step3Sub: 'اختر أسلوبك',
    back: 'رجوع',
    next: 'التالي',
    finish: 'إنهاء',
    saving: 'جارٍ الحفظ...',
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

// ─── Onboarding ───────────────────────────────────────────────────────────────
export default function Onboarding() {
  const router = useRouter()
  const [step, setStep]                       = useState(1)
  const [loading, setLoading]                 = useState(false)
  const [skinTone, setSkinTone]               = useState('')
  const [selectedPalettes, setSelectedPalettes]   = useState<string[]>([])
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([])
  const [lang, setLang]                       = useState<'en' | 'ar'>('en')

  useEffect(() => {
    const locale = (navigator.language || 'en').toLowerCase()
    if (locale.startsWith('ar')) setLang('ar')
  }, [])

  const t    = T[lang]
  const isAr = lang === 'ar'
  const arabicFont = isAr ? "'Noto Naskh Arabic', serif" : 'inherit'

  const togglePalette = (id: string) =>
    setSelectedPalettes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleOccasion = (id: string) =>
    setSelectedOccasions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const saveProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      skin_tone: skinTone,
      preferred_palette: selectedPalettes.join(', '),
      selected_occasions: selectedOccasions,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (error) { alert('Error saving: ' + error.message); setLoading(false) }
    else router.push('/feed')
  }

  const canAdvance =
    (step === 1 && !!skinTone) ||
    (step === 2 && selectedPalettes.length > 0) ||
    step === 3

  return (
    <div
      className="min-h-screen bg-black text-white relative overflow-hidden"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <ParticleCanvas />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm flex flex-col items-center">

          {/* ── Step progress dots ── */}
          <div className="flex gap-2 mb-12">
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className="transition-all duration-500 rounded-full"
                style={{
                  width:  n === step ? '20px' : '6px',
                  height: '6px',
                  background: n === step ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          {/* ── STEP 1: Skin Tone ── */}
          {step === 1 && (
            <div className="w-full text-center animate-in fade-in zoom-in-95 duration-500">
              <h2
                className="text-xl font-extralight tracking-tight mb-2 text-white"
                style={{ fontFamily: arabicFont }}
              >
                {t.step1Title}
              </h2>
              <p
                className="text-zinc-600 text-[10px] uppercase tracking-widest mb-14"
                style={{ fontFamily: arabicFont }}
              >
                {t.step1Sub}
              </p>

              <div className="flex justify-center gap-5 sm:gap-7">
                {SKIN_TONES.map((tone) => {
                  const isSelected = skinTone === tone.id
                  return (
                    <button
                      key={tone.id}
                      onClick={() => setSkinTone(tone.id)}
                      className="group relative flex flex-col items-center outline-none"
                    >
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-500 ease-out ${
                          isSelected
                            ? 'scale-125 ring-2 ring-white ring-offset-4 ring-offset-black shadow-[0_0_30px_rgba(255,255,255,0.25)]'
                            : 'opacity-45 hover:opacity-90 hover:scale-110'
                        }`}
                        style={{ backgroundColor: tone.color }}
                      />
                      <span
                        className={`absolute -bottom-8 text-[9px] uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
                          isSelected
                            ? 'text-white opacity-100 translate-y-0'
                            : 'text-zinc-600 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
                        }`}
                        style={{ fontFamily: arabicFont }}
                      >
                        {isAr ? tone.labelAr : tone.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── STEP 2: Palette ── */}
          {step === 2 && (
            <div className="w-full text-center animate-in fade-in slide-in-from-right-8 duration-500">
              <h2
                className="text-xl font-extralight tracking-tight mb-2 text-white"
                style={{ fontFamily: arabicFont }}
              >
                {t.step2Title}
              </h2>
              <p
                className="text-zinc-600 text-[10px] uppercase tracking-widest mb-10"
                style={{ fontFamily: arabicFont }}
              >
                {t.step2Sub}
              </p>

              <div className="flex flex-col gap-3">
                {COLOR_PALETTES.map((p) => {
                  const isSelected = selectedPalettes.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePalette(p.id)}
                      className={`w-full px-5 py-4 rounded-xl border transition-all duration-300 flex justify-between items-center ${
                        isSelected
                          ? 'bg-zinc-900 border-white/30 shadow-[0_0_16px_rgba(255,255,255,0.07)]'
                          : 'bg-zinc-950 border-zinc-900 hover:border-zinc-700'
                      }`}
                    >
                      <span
                        className={`text-[11px] uppercase tracking-[0.18em] ${isSelected ? 'text-white' : 'text-zinc-500'}`}
                        style={{ fontFamily: arabicFont }}
                      >
                        {isAr ? p.labelAr : p.label}
                      </span>
                      <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <div className="flex -space-x-2">
                          {p.colors.map((c, i) => (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full border-2 border-black"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 border-black flex items-center justify-center transition-all duration-300 ${
                            isSelected ? 'bg-white opacity-100 scale-100' : 'bg-transparent opacity-0 scale-75'
                          }`}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── STEP 3: Occasions ── */}
          {step === 3 && (
            <div className="w-full text-center animate-in fade-in slide-in-from-right-8 duration-500">
              <h2
                className="text-xl font-extralight tracking-tight mb-2 text-white"
                style={{ fontFamily: arabicFont }}
              >
                {t.step3Title}
              </h2>
              <p
                className="text-zinc-600 text-[10px] uppercase tracking-widest mb-10"
                style={{ fontFamily: arabicFont }}
              >
                {t.step3Sub}
              </p>

              <div className="flex flex-wrap justify-center gap-2.5">
                {OCCASION_STYLES.map((occ) => {
                  const isSelected = selectedOccasions.includes(occ.id)
                  return (
                    <button
                      key={occ.id}
                      onClick={() => toggleOccasion(occ.id)}
                      className={`px-5 py-2.5 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 ${
                        isSelected
                          ? 'bg-white text-black border-white shadow-[0_0_16px_rgba(255,255,255,0.25)]'
                          : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                      style={{ fontFamily: arabicFont }}
                    >
                      {isAr ? occ.labelAr : occ.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Nav ── */}
          <div className={`mt-16 flex items-center gap-10 ${isAr ? 'flex-row-reverse' : ''}`}>
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors"
                style={{ fontFamily: arabicFont }}
              >
                {t.back}
              </button>
            )}
            <button
              onClick={() => step < 3 ? setStep(s => s + 1) : saveProfile()}
              disabled={!canAdvance || loading}
              className="text-white text-[10px] uppercase tracking-[0.3em] border-b border-transparent hover:border-white/60 transition-all duration-300 disabled:opacity-25 disabled:cursor-not-allowed pb-0.5"
              style={{ fontFamily: arabicFont }}
            >
              {loading ? t.saving : step === 3 ? t.finish : t.next}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}