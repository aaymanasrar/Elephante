'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getBrandShopLink, type Gender } from '@/lib/affiliates'
import LoadingScreen from '@/app/components/LoadingScreen'
import GradientText from '@/components/GradientText'
import ShinyText from '@/components/ShinyText'
import AmbientParticleCanvas from '@/components/AmbientParticleCanvas'
import { saveAiStylistOutfit } from '@/services/outfitService'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'
import { useArabicTranslations } from '@/hooks/useArabicTranslations'

// ─── Constants ────────────────────────────────────────────────────────────────
const OCCASIONS = [
  'Everyday', 'Office', 'Date Night', 'Weekend',
  'Formal Event', 'Wedding Guest', 'Travel', 'Gallery / Art', 'Festival',
]

const VIBES = [
  'Minimal', 'Bold', 'Classic', 'Edgy',
  'Relaxed', 'Elevated', 'Street', 'Romantic',
]

const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter']

const PIECE_LABELS: Record<string, string> = {
  top: 'TOP',
  bottom: 'BOTTOM',
  shoes: 'SHOES',
  outerwear: 'OUTER',
  accessories: 'EXTRAS',
}

const PIECE_LABELS_AR: Record<string, string> = {
  top: 'علوي',
  bottom: 'سفلي',
  shoes: 'أحذية',
  outerwear: 'خارجي',
  accessories: 'إضافات',
}

const stylistCopy = {
  en: {
    title: 'AI Stylist',
    occasion: 'Occasion',
    vibe: 'Your Vibe',
    season: 'Season',
    curating: 'Curating your looks...',
    generate: 'Generate Looks',
    error: 'Could not reach the stylist. Check your connection.',
    results: (count: number) => `${count} looks curated for you`,
    regenerate: 'Regenerate',
    howToWear: 'How to wear it',
    whyWorks: 'Why it works for you',
    proTip: 'Pro tip',
    imageError: 'Could not generate image. Try again.',
    generating: 'Generating...',
    regenerateImage: 'Regenerate Image',
    visualize: 'Visualize Outfit',
    saved: '✓  Saved',
    save: 'Save Look',
  },
  ar: {
    title: 'AI Stylist',
    occasion: 'المناسبة',
    vibe: 'الأجواء',
    season: 'الموسم',
    curating: 'جارٍ تنسيق الإطلالات...',
    generate: 'توليد إطلالات',
    error: 'تعذّر الوصول إلى المنسق. تحقق من الاتصال.',
    results: (count: number) => `تم تنسيق ${count} إطلالات لك`,
    regenerate: 'إعادة التوليد',
    howToWear: 'طريقة اللبس',
    whyWorks: 'لماذا تناسبك',
    proTip: 'نصيحة',
    imageError: 'تعذّر إنشاء الصورة. حاول مرة أخرى.',
    generating: 'جارٍ الإنشاء...',
    regenerateImage: 'إعادة إنشاء الصورة',
    visualize: 'تصور الإطلالة',
    saved: '✓  محفوظة',
    save: 'حفظ الإطلالة',
  },
} as const

// ─── Particle Canvas ──────────────────────────────────────────────────────────


// ─── Outfit Card ──────────────────────────────────────────────────────────────
interface RealProduct {
  name:      string
  brand:     string
  price:     string
  url:       string
  image_url: string
}

interface OutfitPiece {
  item:     string
  brand:    string | null
  products?: RealProduct[]
}

interface OutfitPieces {
  top:         OutfitPiece
  bottom:      OutfitPiece
  shoes:       OutfitPiece
  outerwear:   OutfitPiece | null
  accessories: OutfitPiece
}

interface Outfit {
  outfit_name: string
  style: string
  occasion: string
  vibe: string
  ease: string
  budget: string
  color_scheme: string
  pieces: OutfitPieces
  how_to_wear: string[]
  why_it_works: string
  styling_tip: string
  key_colors: string[]
}

interface Profile {
  id: string
  userId: string
  gender?: string | null
  skin_tone?: string | null
  body_shape?: string | null
  height_category?: string | null
  [key: string]: unknown
}

function OutfitCard({
  outfit,
  index,
  onSave,
  saved,
  gender,
  profile,
  isAr,
  copy,
}: {
  outfit: Outfit
  index: number
  onSave: (o: Outfit, imageUrl?: string | null) => void
  saved: boolean
  gender: Gender
  profile: Profile | null
  isAr: boolean
  copy: typeof stylistCopy.en | typeof stylistCopy.ar
}) {
  const [showDetails, setShowDetails]       = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [visualizing, setVisualizing]       = useState(false)
  const [imgError, setImgError]             = useState('')

  const visualize = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setVisualizing(true)
    setImgError('')
    try {
      const res = await fetch('/api/generate-outfit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outfit, profile }),
      })
      const data = await res.json()
      if (data.error) { setImgError(data.error); return }
      setGeneratedImage(data.resourceUrl || data.image)
    } catch {
      setImgError(copy.imageError)
    } finally {
      setVisualizing(false)
    }
  }

  const tr = useArabicTranslations([
    outfit.outfit_name,
    outfit.style,
    outfit.occasion,
    outfit.vibe,
    outfit.ease,
    outfit.budget,
    outfit.color_scheme,
    outfit.why_it_works,
    outfit.styling_tip,
    ...(outfit.how_to_wear || []),
    ...Object.values(outfit.pieces || {}).flatMap((piece) => piece ? [piece.item] : []),
  ], isAr)

  return (
    <div
      className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-950 overflow-hidden"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* ── Top bar ── */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-1.5">
        {(outfit.key_colors || []).slice(0, 3).map((hex, i) => (
          <div key={i} className="w-5 h-5 rounded-full border-2 border-black shadow-sm flex-shrink-0" style={{ backgroundColor: hex }} />
        ))}
      </div>

      {/* ── Name + meta ── */}
      <div className="px-5 pb-4">
        <h2 className="text-xl font-extralight tracking-tight text-white leading-tight">{tr(outfit.outfit_name)}</h2>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-zinc-500 text-[11px] italic">{tr(outfit.vibe)}</span>
          <span className="text-zinc-800 text-[9px]">·</span>
          <span className={`text-[9px] text-zinc-600 border border-zinc-900 rounded-full px-2 py-0.5 ${isAr ? '' : 'uppercase tracking-[0.2em]'}`}>{tr(outfit.style)}</span>
        </div>
      </div>

      <div className="h-px bg-zinc-900 mx-5" />

      {/* ── Pieces ── */}
      <div className="px-5 py-4 space-y-3">
        {(Object.keys(PIECE_LABELS) as (keyof OutfitPieces)[]).map((key) => {
          const piece = outfit.pieces?.[key]
          if (!piece?.item) return null
          const shop = getBrandShopLink(piece.brand, piece.item, gender)
          return (
            <div key={key} className="flex gap-3 items-start">
              <span className={`text-[9px] text-zinc-700 w-12 flex-shrink-0 pt-1 ${isAr ? '' : 'uppercase tracking-[0.2em]'}`}>{isAr ? PIECE_LABELS_AR[key] : PIECE_LABELS[key]}</span>
              <div className="flex-1 flex items-start justify-between gap-2 min-w-0">
                <span className="text-[12px] text-zinc-200 leading-snug flex-1">{tr(piece.item)}</span>
                {shop && (
                  <a href={shop.url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 px-2.5 py-1 rounded-full border border-zinc-800 text-[9px] uppercase tracking-widest text-zinc-400 hover:border-white/40 hover:text-white transition-all duration-200 whitespace-nowrap"
                    onClick={e => e.stopPropagation()}>
                    {piece.brand || shop.label}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── How to wear ── */}
      {(outfit.how_to_wear || []).length > 0 && (
        <>
          <div className="h-px bg-zinc-900 mx-5" />
          <div className="px-5 py-4">
            <p className={`text-[9px] text-zinc-600 mb-3 ${isAr ? '' : 'uppercase tracking-[0.25em]'}`}>{copy.howToWear}</p>
            <div className="space-y-2">
              {outfit.how_to_wear.map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-[9px] text-zinc-700 font-bold w-4 flex-shrink-0 pt-0.5">{i + 1}</span>
                  <span className="text-[12px] text-zinc-400 leading-snug">{tr(step)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Why it works ── */}
      <div className="px-5 pb-2">
        <button onClick={() => setShowDetails(v => !v)} className="w-full text-left flex items-center justify-between group py-2">
          <span className={`text-[9px] text-zinc-700 group-hover:text-zinc-400 transition-colors ${isAr ? '' : 'uppercase tracking-[0.25em]'}`}>{copy.whyWorks}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-zinc-700 transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {showDetails && (
          <div className="pb-3 space-y-3 animate-in fade-in duration-200">
            <p className="text-[12px] text-zinc-400 leading-relaxed">{tr(outfit.why_it_works)}</p>
            {outfit.styling_tip && (
              <div className="border-l-2 border-zinc-800 pl-3">
                <p className={`text-[9px] text-zinc-600 mb-1 ${isAr ? '' : 'uppercase tracking-[0.2em]'}`}>{copy.proTip}</p>
                <p className="text-[12px] text-zinc-400 leading-relaxed">{tr(outfit.styling_tip)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Generated image ── */}
      {generatedImage && (
        <div className="px-5 pb-4">
          <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900 aspect-square">
            <img src={generatedImage} alt={isAr ? 'إطلالة مولّدة' : 'Generated outfit'} className="w-full h-full object-cover" />
            <button
              onClick={() => setGeneratedImage(null)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-zinc-400 hover:text-white transition-colors backdrop-blur-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Save + Visualize ── */}
      <div className="px-5 pb-5 pt-1 space-y-2.5">
        <button
          onClick={visualize}
          disabled={visualizing}
          className="w-full h-11 rounded-full border border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-[0.3em] hover:border-zinc-600 hover:text-white transition-all duration-300 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {visualizing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
              {copy.generating}
            </>
          ) : (
            generatedImage ? copy.regenerateImage : copy.visualize
          )}
        </button>
        {imgError && <p className="text-red-400 text-[11px] text-center">{imgError}</p>}
        <button
          onClick={() => !saved && onSave(outfit, generatedImage)}
          disabled={saved}
          className={`w-full h-11 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] transition-all duration-300 active:scale-95 ${
            saved ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-default' : 'bg-white text-black hover:bg-zinc-200'
          }`}
        >
          {saved ? copy.saved : copy.save}
        </button>
      </div>
    </div>
  )
}

// ─── AI Stylist Page ──────────────────────────────────────────────────────────
export default function AIStylist() {
  const router = useRouter()
  const { lang, isAr } = useLocale()
  const copy = isAr ? stylistCopy.ar : stylistCopy.en

  const [profile, setProfile]         = useState<Profile | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [outfits, setOutfits]         = useState<Outfit[]>([])
  const [error, setError]             = useState('')
  const [savedNames, setSavedNames]   = useState<Set<string>>(new Set())

  // Form
  const [occasion, setOccasion]           = useState('Everyday')
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [season, setSeason]               = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile({ ...data, userId: user.id })
      setPageLoading(false)
    }
    load()
  }, [router])

  const toggleVibe = (v: string) =>
    setSelectedVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])

  const generate = async () => {
    setGenerating(true)
    setError('')
    setOutfits([])
    setSavedNames(new Set())

    try {
      const mood = selectedVibes.join(', ') || 'balanced'
      const res  = await fetch('/api/outfit-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, occasion, mood, season, language: lang }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setOutfits(data.outfits || [])
    } catch {
      setError(copy.error)
    } finally {
      setGenerating(false)
    }
  }

  const saveOutfit = async (outfit: Outfit, imageUrl?: string | null) => {
    if (!profile?.userId) return

    const { inserted, error } = await saveAiStylistOutfit(outfit, profile.userId, profile?.gender, imageUrl)

    if (error || !inserted?.id) {
      console.error('[ai-stylist] save failed:', error?.message)
      return
    }

    setSavedNames(prev => new Set([...prev, outfit.outfit_name]))
  }

  const trControl = useArabicTranslations([...OCCASIONS, ...VIBES, ...SEASONS], isAr)
  if (pageLoading) return <LoadingScreen />

  return (
    <div className="h-[100dvh] bg-black text-white relative flex flex-col overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <AmbientParticleCanvas />

      {/* ── Header ── */}
      <nav className="fixed top-0 w-full z-50 px-5 py-5 flex justify-between items-center">
        <button onClick={() => router.back()} className="text-zinc-600 hover:text-white transition-colors min-h-[44px] flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <GradientText
          colors={['#ffffff', '#71717a', '#ffffff', '#52525b', '#ffffff']}
          animationSpeed={6}
          className="text-[10px] tracking-[0.4em] uppercase"
        >
          {copy.title}
        </GradientText>
        <div className="w-7" />
      </nav>

      {/* ── Scrollable content (scrollbar hidden) ── */}
      <div
        className="relative z-10 flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        <div className="max-w-sm mx-auto px-5 pt-20 pb-8 space-y-10" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>

          {/* ── Profile summary ── */}
          {profile && (
            <div className="flex flex-wrap gap-2">
              {profile.skin_tone && <span className="text-[9px] uppercase tracking-widest text-zinc-600 border border-zinc-900 rounded-full px-3 py-1.5">{profile.skin_tone} {isAr ? 'بشرة' : 'skin'}</span>}
              {profile.body_shape && <span className="text-[9px] uppercase tracking-widest text-zinc-600 border border-zinc-900 rounded-full px-3 py-1.5">{profile.body_shape}</span>}
              {profile.height_category && <span className="text-[9px] uppercase tracking-widest text-zinc-600 border border-zinc-900 rounded-full px-3 py-1.5">{profile.height_category}</span>}
            </div>
          )}

          {/* ── Occasion ── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{copy.occasion}</p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map(o => (
                <button key={o} onClick={() => setOccasion(o)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 min-h-[36px] flex items-center justify-center ${
                    occasion === o ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                  }`}>{trControl(o)}</button>
              ))}
            </div>
          </section>

          {/* ── Vibe ── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{copy.vibe}</p>
            <div className="flex flex-wrap gap-2">
              {VIBES.map(v => (
                <button key={v} onClick={() => toggleVibe(v)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 min-h-[36px] flex items-center justify-center ${
                    selectedVibes.includes(v) ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                  }`}>{trControl(v)}</button>
              ))}
            </div>
          </section>

          {/* ── Season ── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{copy.season}</p>
            <div className="flex gap-2">
              {SEASONS.map(s => (
                <button key={s} onClick={() => setSeason(prev => prev === s ? '' : s)}
                  className={`flex-shrink-0 flex-1 px-4 py-2 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 min-h-[36px] flex items-center justify-center ${
                    season === s ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                  }`}>{trControl(s)}</button>
              ))}
            </div>
          </section>

          {/* ── Generate button ── */}
          <button onClick={generate} disabled={generating}
            className="w-full h-14 rounded-2xl bg-white text-black font-bold text-[11px] uppercase tracking-[0.35em] hover:bg-zinc-100 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
            {generating ? (
              <span className="flex items-center justify-center gap-3">
                <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                {copy.curating}
              </span>
            ) : copy.generate}
          </button>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          {/* ── Shimmer ── */}
          {generating && (
            <div className="space-y-4">
              {[0,1,2].map(i => (
                <div key={i} className="w-full h-64 rounded-2xl border border-zinc-900 bg-zinc-950 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          )}

          {/* ── Results ── */}
          {outfits.length > 0 && !generating && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <p className="text-center">
                <ShinyText
                  text={copy.results(outfits.length)}
                  className="text-[9px] uppercase tracking-[0.4em]"
                  color="rgba(113,113,122,0.7)"
                  shineColor="rgba(255,255,255,0.85)"
                  speed={4}
                  spread={20}
                />
              </p>
              {outfits.map((outfit, i) => (
                <OutfitCard key={i} outfit={outfit} index={i} onSave={saveOutfit} saved={savedNames.has(outfit.outfit_name)} gender={(profile?.gender as Gender) || 'male'} profile={profile} isAr={isAr} copy={copy} />
              ))}
              <button onClick={generate} className="w-full h-11 rounded-full border border-zinc-800 text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:border-zinc-600 hover:text-zinc-300 transition-all duration-300">
                {copy.regenerate}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
