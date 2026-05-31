'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import GradientText from '@/components/GradientText'
import AmbientParticleCanvas from '@/components/AmbientParticleCanvas'
import LoadingScreen from '@/app/components/LoadingScreen'
import { useLocale } from '@/lib/locale-context'

// ─── Constants ────────────────────────────────────────────────────────────────
const DURATIONS = [
  { key: 'Weekend (2–3 days)', label: 'Weekend (2–3 days)', labelAr: 'نهاية أسبوع (2–3 أيام)' },
  { key: 'Short Trip (4–6 days)', label: 'Short Trip (4–6 days)', labelAr: 'رحلة قصيرة (4–6 أيام)' },
  { key: 'Week (7 days)', label: 'Week (7 days)', labelAr: 'أسبوع (7 أيام)' },
  { key: '2+ Weeks', label: '2+ Weeks', labelAr: 'أسبوعان وأكثر' },
]

const OCCASIONS_LIST = [
  { key: 'Business', labelAr: 'عمل' },
  { key: 'Leisure', labelAr: 'ترفيه' },
  { key: 'Beach', labelAr: 'شاطئ' },
  { key: 'Formal Event', labelAr: 'مناسبة رسمية' },
  { key: 'Outdoor / Adventure', labelAr: 'خارج المنزل' },
  { key: 'Wedding / Celebration', labelAr: 'زفاف / احتفال' },
]

const CLIMATES = [
  { key: 'Hot & Humid', labelAr: 'حار ورطب' },
  { key: 'Hot & Dry', labelAr: 'حار وجاف' },
  { key: 'Warm', labelAr: 'دافئ' },
  { key: 'Mild', labelAr: 'معتدل' },
  { key: 'Cold', labelAr: 'بارد' },
  { key: 'Very Cold', labelAr: 'بارد جداً' },
]

const copy = {
  en: {
    title: 'Pack for a Trip',
    destination: 'Destination',
    destinationPlaceholder: 'Where are you going? (e.g. Paris, Dubai, Tokyo)',
    duration: 'Trip Duration',
    occasions: 'Occasions',
    climate: 'Climate',
    generate: 'Pack My Bag',
    generating: 'Packing your bag...',
    error: 'Could not generate your packing list. Try again.',
    destSummary: 'Destination',
    outfits: 'Outfits',
    essentials: 'Essentials',
    shoes: 'Shoes',
    accessories: 'Accessories',
    proTip: 'Pro Tip',
  },
  ar: {
    title: 'حقيبة السفر',
    destination: 'الوجهة',
    destinationPlaceholder: 'إلى أين أنت ذاهب؟ (مثال: باريس، دبي، طوكيو)',
    duration: 'مدة الرحلة',
    occasions: 'المناسبات',
    climate: 'المناخ',
    generate: 'جهّز حقيبتي',
    generating: 'جارٍ تجهيز حقيبتك...',
    error: 'تعذّر إنشاء قائمة التعبئة. حاول مرة أخرى.',
    destSummary: 'الوجهة',
    outfits: 'الإطلالات',
    essentials: 'الضروريات',
    shoes: 'الأحذية',
    accessories: 'الإكسسوارات',
    proTip: 'نصيحة',
  },
} as const

interface OutfitDay {
  day: string
  outfit: string
  occasion: string
}

interface PackingList {
  destination_summary: string
  outfits: OutfitDay[]
  essentials: string[]
  shoes: string[]
  accessories: string[]
  pro_tip: string
}

interface Profile {
  gender?: string | null
  skin_tone?: string | null
  body_shape?: string | null
  style?: string | null
  style_pref?: string | null
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function TravelPackPage() {
  const router = useRouter()
  const { isAr } = useLocale()
  const t = isAr ? copy.ar : copy.en

  const [pageLoading, setPageLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  const [destination, setDestination] = useState('')
  const [duration, setDuration] = useState('')
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([])
  const [climate, setClimate] = useState('')

  const [generating, setGenerating] = useState(false)
  const [packingList, setPackingList] = useState<PackingList | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setPageLoading(false)
    }
    load()
  }, [router])

  const toggleOccasion = (occ: string) =>
    setSelectedOccasions(prev =>
      prev.includes(occ) ? prev.filter(x => x !== occ) : [...prev, occ]
    )

  const handleGenerate = async () => {
    if (!destination.trim()) return
    setGenerating(true)
    setError('')
    setPackingList(null)

    try {
      const res = await fetch('/api/travel-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination.trim(),
          duration: duration || 'Weekend (2–3 days)',
          occasions: selectedOccasions,
          climate: climate || 'Warm',
          profile,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      if (!data.packingList || (!data.packingList.outfits && !data.packingList.essentials)) {
        setError(t.error)
        return
      }
      setPackingList(data.packingList)
    } catch {
      setError(t.error)
    } finally {
      setGenerating(false)
    }
  }

  if (pageLoading) return <LoadingScreen />

  return (
    <div
      className="h-[100dvh] bg-black text-white relative flex flex-col overflow-hidden"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <AmbientParticleCanvas />

      {/* ── Header ── */}
      <nav className="fixed top-0 w-full z-50 px-5 py-5 flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className="text-zinc-600 hover:text-white transition-colors min-h-[44px] flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <GradientText
          colors={['#ffffff', '#71717a', '#ffffff', '#52525b', '#ffffff']}
          animationSpeed={6}
          className="text-[10px] tracking-[0.4em] uppercase"
        >
          {t.title}
        </GradientText>
        <div className="w-7" />
      </nav>

      {/* ── Scrollable content ── */}
      <div
        className="relative z-10 flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        <div
          className="max-w-sm mx-auto px-5 pt-20 pb-8 space-y-10"
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
        >

          {/* ── Destination ── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{t.destination}</p>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder={t.destinationPlaceholder}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600 transition-colors"
            />
          </section>

          {/* ── Trip Duration ── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{t.duration}</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d.key}
                  onClick={() => setDuration(d.key)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 min-h-[36px] flex items-center justify-center ${
                    duration === d.key
                      ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]'
                      : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {isAr ? d.labelAr : d.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Occasions ── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{t.occasions}</p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS_LIST.map(o => (
                <button
                  key={o.key}
                  onClick={() => toggleOccasion(o.key)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 min-h-[36px] flex items-center justify-center ${
                    selectedOccasions.includes(o.key)
                      ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]'
                      : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {isAr ? o.labelAr : o.key}
                </button>
              ))}
            </div>
          </section>

          {/* ── Climate ── */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{t.climate}</p>
            <div className="flex flex-wrap gap-2">
              {CLIMATES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setClimate(c.key)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 min-h-[36px] flex items-center justify-center ${
                    climate === c.key
                      ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]'
                      : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {isAr ? c.labelAr : c.key}
                </button>
              ))}
            </div>
          </section>

          {/* ── Generate button ── */}
          <button
            onClick={handleGenerate}
            disabled={generating || !destination.trim()}
            className="w-full h-14 rounded-2xl bg-white text-black font-bold text-[11px] uppercase tracking-[0.35em] hover:bg-zinc-100 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-3">
                <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                {t.generating}
              </span>
            ) : t.generate}
          </button>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          {/* ── Shimmer ── */}
          {generating && (
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-full h-24 rounded-2xl border border-zinc-900 bg-zinc-950 animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          )}

          {/* ── Results ── */}
          {packingList && !generating && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

              {/* Destination summary */}
              {packingList.destination_summary && (
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-2">{t.destSummary}</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{packingList.destination_summary}</p>
                </div>
              )}

              {/* Outfits */}
              {packingList.outfits?.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{t.outfits}</p>
                  <div className="space-y-3">
                    {packingList.outfits.map((item, i) => (
                      <div key={i} className="rounded-xl border border-zinc-800/80 bg-zinc-950 px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">{item.day}</span>
                          {item.occasion && (
                            <span className="text-[9px] uppercase tracking-widest text-zinc-700 border border-zinc-800 rounded-full px-2 py-0.5">{item.occasion}</span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-200 leading-relaxed">{item.outfit}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Essentials */}
              {packingList.essentials?.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{t.essentials}</p>
                  <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 px-5 py-4 space-y-2">
                    {packingList.essentials.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-1 h-1 rounded-full bg-zinc-600 mt-2 flex-shrink-0" />
                        <span className="text-sm text-zinc-300 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Shoes */}
              {packingList.shoes?.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{t.shoes}</p>
                  <div className="flex flex-col gap-2">
                    {packingList.shoes.map((shoe, i) => (
                      <div key={i} className="rounded-xl border border-zinc-800/80 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                        {shoe}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Accessories */}
              {packingList.accessories?.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-4">{t.accessories}</p>
                  <div className="flex flex-wrap gap-2">
                    {packingList.accessories.map((acc, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-950 text-[11px] text-zinc-400"
                      >
                        {acc}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Pro Tip */}
              {packingList.pro_tip && (
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950 px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-2">{t.proTip}</p>
                  <p className="text-sm text-zinc-300 leading-relaxed border-l-2 border-zinc-700 pl-3">{packingList.pro_tip}</p>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
