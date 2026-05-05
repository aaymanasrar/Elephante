// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LoadingScreen from '@/app/components/LoadingScreen'
import { useLocale } from '@/lib/locale-context'

// ─── Data ─────────────────────────────────────────────────────────────────────
const SKIN_TONES = [
  { id: 'light',  color: '#FFE0BD', label: 'Light', labelAr: 'فاتحة' },
  { id: 'medium', color: '#D2B48C', label: 'Medium', labelAr: 'متوسطة' },
  { id: 'tan',    color: '#AF8154', label: 'Tan', labelAr: 'سمراء' },
  { id: 'dark',   color: '#5C3816', label: 'Deep', labelAr: 'داكنة' },
]

const SKIN_UNDERTONES = [
  { id: 'cool',    label: 'Cool', labelAr: 'باردة', hint: 'pink · blue · red', hintAr: 'وردي · أزرق · أحمر' },
  { id: 'neutral', label: 'Neutral', labelAr: 'محايدة', hint: 'mix of both', hintAr: 'مزيج بينهما' },
  { id: 'warm',    label: 'Warm', labelAr: 'دافئة', hint: 'yellow · peach · gold', hintAr: 'أصفر · خوخي · ذهبي' },
]

const HEIGHTS = [
  { id: 'short',   label: 'Short', labelAr: 'قصير', sub: "Under 5'7\"", subAr: 'أقل من 170 سم' },
  { id: 'average', label: 'Average', labelAr: 'متوسط', sub: "5'7\" – 6'0\"", subAr: '170 - 183 سم' },
  { id: 'tall',    label: 'Tall', labelAr: 'طويل', sub: "Over 6'0\"", subAr: 'أكثر من 183 سم' },
]

const BODY_SHAPES = [
  { id: 'slim',     label: 'Slim', labelAr: 'نحيف', sub: 'Lean build', subAr: 'بنية نحيلة' },
  { id: 'athletic', label: 'Athletic', labelAr: 'رياضي', sub: 'Toned', subAr: 'مشدود' },
  { id: 'average',  label: 'Average', labelAr: 'متوسط', sub: 'Medium', subAr: 'متوسط' },
  { id: 'stocky',   label: 'Stocky', labelAr: 'ممتلئ', sub: 'Solid', subAr: 'صلب' },
  { id: 'heavy',    label: 'Heavy', labelAr: 'ثقيل', sub: 'Large', subAr: 'كبير' },
]

const COLOR_PALETTES = [
  { id: 'neutral',  label: 'Neutral', labelAr: 'محايد', colors: ['#F5F5DC', '#D3D3D3', '#FFFFFF', '#8B7355'] },
  { id: 'dark',     label: 'Dark / Moody', labelAr: 'داكن / هادئ', colors: ['#000000', '#2F4F4F', '#000080', '#363636'] },
  { id: 'pastel',   label: 'Soft / Pastel', labelAr: 'ناعم / باستيل', colors: ['#FFB6C1', '#ADD8E6', '#E6E6FA', '#FFE4E1'] },
  { id: 'colorful', label: 'Vibrant', labelAr: 'زاهي', colors: ['#FF4500', '#32CD32', '#FFD700', '#4169E1'] },
]

const OCCASIONS = [
  { id: 'Business Casual', label: 'Business Casual', labelAr: 'كاجوال أعمال' },
  { id: 'Smart Casual',    label: 'Smart Casual', labelAr: 'كاجوال أنيق' },
  { id: 'Traditional',     label: 'Traditional', labelAr: 'تقليدي' },
  { id: 'Formal',          label: 'Formal', labelAr: 'رسمي' },
  { id: 'Streetwear',      label: 'Streetwear', labelAr: 'ستريتوير' },
]

const preferencesCopy = {
  en: {
    cancel: 'Cancel',
    preferences: 'Preferences',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    skinTone: 'Skin Tone',
    undertone: 'Undertone',
    height: 'Height',
    bodyShape: 'Body Shape',
    aesthetics: 'Aesthetics',
    lifestyle: 'Lifestyle',
    updating: 'Updating...',
    save: 'Save Preferences',
  },
  ar: {
    cancel: 'إلغاء',
    preferences: 'التفضيلات',
    gender: 'النوع',
    male: 'رجالي',
    female: 'نسائي',
    skinTone: 'لون البشرة',
    undertone: 'الدرجة الداخلية',
    height: 'الطول',
    bodyShape: 'شكل الجسم',
    aesthetics: 'الذوق',
    lifestyle: 'نمط الحياة',
    updating: 'جارٍ التحديث...',
    save: 'حفظ التفضيلات',
  },
} as const

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
  const { isAr } = useLocale()
  const t = isAr ? preferencesCopy.ar : preferencesCopy.en
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [gender, setGender]     = useState('')
  const [skinTone, setSkinTone] = useState('')
  const [skinUndertone, setSkinUndertone] = useState('')
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
        setGender(data.gender || '')
        setSkinTone(data.skin_tone || '')
        setSkinUndertone(data.skin_undertone || '')
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
        gender,
        skin_tone: skinTone,
        skin_undertone: skinUndertone || null,
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

  if (loading) return <LoadingScreen />

  // shared class strings
  const sectionTitle = `text-[10px] text-zinc-500 mb-5 ${isAr ? '' : 'uppercase tracking-[0.25em]'}`
  const cardBase = `p-3 rounded-xl border text-center transition-all duration-300 text-xs font-semibold ${isAr ? '' : 'uppercase tracking-wider'}`
  const cardOn   = "bg-white text-black border-white"
  const cardOff  = "bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300"

  return (
    <div className="min-h-screen bg-black text-white relative" dir={isAr ? 'rtl' : 'ltr'}>
      <ParticleCanvas />

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-sm border-b border-zinc-900 px-5 py-4 flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className={`text-zinc-600 text-[10px] hover:text-white transition-colors min-h-[44px] flex items-center ${isAr ? '' : 'uppercase tracking-[0.3em]'}`}
        >
          {t.cancel}
        </button>
        <h1 className={`text-[11px] font-bold text-zinc-400 ${isAr ? '' : 'tracking-[0.3em] uppercase'}`}>
          {t.preferences}
        </h1>
        <div className="w-14" />
      </div>

      {/* ── Scrollable content ── */}
      <div className="relative z-10 max-w-sm mx-auto px-5 py-10 pb-36 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Gender */}
        <section>
          <p className={sectionTitle}>{t.gender}</p>
          <div className="flex gap-3">
            {[
              { id: 'male',   label: t.male   },
              { id: 'female', label: t.female },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setGender(opt.id)}
                className={`flex-1 py-4 rounded-xl border text-[11px] font-bold transition-all duration-300 ${isAr ? '' : 'uppercase tracking-[0.2em]'} ${
                  gender === opt.id ? cardOn : cardOff
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Skin Tone */}
        <section>
          <p className={sectionTitle}>{t.skinTone}</p>
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
                <span className={`text-[9px] transition-colors ${isAr ? '' : 'uppercase tracking-widest'} ${
                  skinTone === tone.id ? 'text-white' : 'text-zinc-700 group-hover:text-zinc-400'
                }`}>
                  {isAr ? tone.labelAr : tone.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Skin Undertone */}
        <section>
          <p className={sectionTitle}>{t.undertone}</p>
          <div className="flex gap-2.5">
            {SKIN_UNDERTONES.map((u) => (
              <button
                key={u.id}
                onClick={() => setSkinUndertone(prev => prev === u.id ? '' : u.id)}
                className={`flex-1 py-3 px-2 rounded-xl border text-center transition-all duration-300 ${
                  skinUndertone === u.id ? cardOn : cardOff
                }`}
              >
                <div className="font-bold text-[11px]">{isAr ? u.labelAr : u.label}</div>
                <div className="text-[9px] opacity-60 mt-0.5">{isAr ? u.hintAr : u.hint}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Height */}
        <section>
          <p className={sectionTitle}>{t.height}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {HEIGHTS.map((h) => (
              <button
                key={h.id}
                onClick={() => setHeight(h.id)}
                className={`${cardBase} ${height === h.id ? cardOn : cardOff}`}
              >
                <div className="font-bold text-[11px]">{isAr ? h.labelAr : h.label}</div>
                <div className="text-[9px] opacity-60 mt-0.5">{isAr ? h.subAr : h.sub}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Body Shape */}
        <section>
          <p className={sectionTitle}>{t.bodyShape}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {BODY_SHAPES.map((b) => (
              <button
                key={b.id}
                onClick={() => setBodyShape(b.id)}
                className={`${cardBase} ${bodyShape === b.id ? cardOn : cardOff}`}
              >
                <div className="font-bold text-[11px]">{isAr ? b.labelAr : b.label}</div>
                <div className="text-[9px] opacity-60 mt-0.5">{isAr ? b.subAr : b.sub}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Aesthetics */}
        <section>
          <p className={sectionTitle}>{t.aesthetics}</p>
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
                  <span className={`text-[11px] ${isAr ? '' : 'uppercase tracking-[0.18em]'} ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                    {isAr ? p.labelAr : p.label}
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
          <p className={sectionTitle}>{t.lifestyle}</p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((occ) => {
              const isSelected = selectedOccasions.includes(occ.id)
              return (
                <button
                  key={occ.id}
                  onClick={() => toggleOccasion(occ.id)}
                  className={`px-4 py-2 rounded-full border text-[10px] font-semibold transition-all duration-300 min-h-[40px] ${isAr ? '' : 'uppercase tracking-widest'} ${
                    isSelected
                      ? 'bg-white text-black border-white shadow-[0_0_14px_rgba(255,255,255,0.2)]'
                      : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {isAr ? occ.labelAr : occ.label}
                </button>
              )
            })}
          </div>
        </section>

      </div>

      {/* ── Save button ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black to-transparent pt-10 pb-6 px-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full max-w-sm mx-auto flex items-center justify-center h-12 bg-white text-black rounded-full font-bold text-[10px] hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-40 ${isAr ? '' : 'uppercase tracking-[0.3em]'}`}
        >
          {saving ? t.updating : t.save}
        </button>
      </div>
    </div>
  )
}
