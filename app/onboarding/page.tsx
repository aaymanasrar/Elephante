'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ParticleCanvas from '@/components/ParticleCanvas'
import LoadingSpinner from '@/components/LoadingSpinner'
import { COLOR_PALETTES, OCCASION_STYLES, SKIN_TONES, SKIN_UNDERTONES } from '@/data/onboarding'
import { onboardingTranslations } from '@/data/translations'
import { useRequireUser } from '@/hooks/useRequireUser'
import { getFriendlyProfileError } from '@/lib/supabaseErrors'
import { useLocale } from '@/lib/locale-context'

export default function Onboarding() {
  const router = useRouter()
  const { user, loading: userLoading, error: userError } = useRequireUser('/login')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [gender, setGender] = useState('')
  const [skinTone, setSkinTone] = useState('')
  const [skinUndertone, setSkinUndertone] = useState('')
  const [selectedPalettes, setSelectedPalettes] = useState<string[]>([])
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([])
  const { lang, isAr } = useLocale()
  const [error, setError] = useState('')

  const t = onboardingTranslations[lang]
  const arabicFont = isAr ? 'var(--font-arabic, serif)' : 'inherit'

  const togglePalette = (id: string) => {
    setSelectedPalettes((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id])
  }

  const toggleOccasion = (id: string) => {
    setSelectedOccasions((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id])
  }

  const saveProfile = async () => {
    if (!user) return
    setLoading(true)
    setError('')

    try {
      const { error: saveError } = await supabase.from('profiles').upsert({
        id: user.id,
        gender,
        skin_tone: skinTone,
        skin_undertone: skinUndertone || null,
        preferred_palette: selectedPalettes.join(', '),
        selected_occasions: selectedOccasions,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      if (saveError) {
        setError(getFriendlyProfileError(saveError.message) || t.saveError)
        return
      }

      router.push('/feed')
    } catch {
      setError(t.saveError)
    } finally {
      setLoading(false)
    }
  }

  const canAdvance =
    (step === 1 && Boolean(gender)) ||
    (step === 2 && Boolean(skinTone)) ||
    (step === 3 && selectedPalettes.length > 0) ||
    step === 4

  if (userLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <ParticleCanvas />
        <div className="relative z-10">
          <LoadingSpinner text="Loading Onboarding..." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white relative" dir={isAr ? 'rtl' : 'ltr'}>
      <ParticleCanvas />

      <div className="relative z-10 min-h-[100dvh] flex items-center justify-center px-4 py-16 overflow-y-auto">
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="flex gap-2 mb-12">
            {[1, 2, 3, 4].map((value) => (
              <div
                key={value}
                className="transition-all duration-500 rounded-full"
                style={{
                  width: value === step ? '20px' : '6px',
                  height: '6px',
                  background: value === step ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="w-full text-center animate-in fade-in zoom-in-95 duration-500">
              <h2 className="text-xl font-extralight tracking-tight mb-2 text-white" style={{ fontFamily: arabicFont }}>
                {t.step1Title}
              </h2>
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-12" style={{ fontFamily: arabicFont }}>
                {t.step1Sub}
              </p>

              <div className="flex gap-4 w-full">
                {[
                  { id: 'male', label: isAr ? '\u0631\u062c\u0627\u0644\u064a' : 'Male' },
                  { id: 'female', label: isAr ? '\u0646\u0633\u0627\u0626\u064a' : 'Female' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setGender(option.id)}
                    className={`flex-1 py-10 rounded-2xl border text-sm font-light tracking-[0.25em] uppercase transition-all duration-400 ${
                      gender === option.id
                        ? 'bg-white text-black border-white shadow-[0_0_40px_rgba(255,255,255,0.12)]'
                        : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                    }`}
                    style={{ fontFamily: arabicFont }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="w-full text-center animate-in fade-in zoom-in-95 duration-500">
              <h2 className="text-xl font-extralight tracking-tight mb-2 text-white" style={{ fontFamily: arabicFont }}>
                {t.step2Title}
              </h2>
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-14" style={{ fontFamily: arabicFont }}>
                {t.step2Sub}
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

              {/* Undertone */}
              <div className="mt-16">
                <p className="text-zinc-600 text-[9px] uppercase tracking-[0.25em] mb-5" style={{ fontFamily: arabicFont }}>
                  {isAr ? 'درجة اللون الداخلية' : 'Undertone'}
                </p>
                <div className="flex gap-2.5 justify-center">
                  {SKIN_UNDERTONES.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSkinUndertone(prev => prev === u.id ? '' : u.id)}
                      className={`flex-1 py-3 px-2 rounded-xl border transition-all duration-300 ${
                        skinUndertone === u.id
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ fontFamily: arabicFont }}>
                        {isAr ? u.labelAr : u.label}
                      </div>
                      <div className={`text-[8px] mt-0.5 ${skinUndertone === u.id ? 'text-zinc-600' : 'text-zinc-700'}`}>
                        {u.hint}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="w-full text-center animate-in fade-in slide-in-from-right-8 duration-500">
              <h2 className="text-xl font-extralight tracking-tight mb-2 text-white" style={{ fontFamily: arabicFont }}>
                {t.step3Title}
              </h2>
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-10" style={{ fontFamily: arabicFont }}>
                {t.step3Sub}
              </p>

              <div className="flex flex-col gap-3">
                {COLOR_PALETTES.map((palette) => {
                  const isSelected = selectedPalettes.includes(palette.id)
                  return (
                    <button
                      key={palette.id}
                      onClick={() => togglePalette(palette.id)}
                      className={`w-full px-5 py-4 rounded-xl border transition-all duration-300 flex justify-between items-center ${
                        isSelected
                          ? 'bg-zinc-900 border-white/30 shadow-[0_0_16px_rgba(255,255,255,0.07)]'
                          : 'bg-zinc-950 border-zinc-900 hover:border-zinc-700'
                      }`}
                    >
                      <span className={`text-[11px] uppercase tracking-[0.18em] ${isSelected ? 'text-white' : 'text-zinc-500'}`} style={{ fontFamily: arabicFont }}>
                        {isAr ? palette.labelAr : palette.label}
                      </span>
                      <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <div className="flex -space-x-2">
                          {palette.colors.map((color) => (
                            <div
                              key={color}
                              className="w-6 h-6 rounded-full border-2 border-black"
                              style={{ backgroundColor: color }}
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

          {step === 4 && (
            <div className="w-full text-center animate-in fade-in slide-in-from-right-8 duration-500">
              <h2 className="text-xl font-extralight tracking-tight mb-2 text-white" style={{ fontFamily: arabicFont }}>
                {t.step4Title}
              </h2>
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-10" style={{ fontFamily: arabicFont }}>
                {t.step4Sub}
              </p>

              <div className="flex flex-wrap justify-center gap-2.5">
                {OCCASION_STYLES.map((occasion) => {
                  const isSelected = selectedOccasions.includes(occasion.id)
                  return (
                    <button
                      key={occasion.id}
                      onClick={() => toggleOccasion(occasion.id)}
                      className={`px-5 py-2.5 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 ${
                        isSelected
                          ? 'bg-white text-black border-white shadow-[0_0_16px_rgba(255,255,255,0.25)]'
                          : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                      style={{ fontFamily: arabicFont }}
                    >
                      {isAr ? occasion.labelAr : occasion.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {error || userError ? (
            <p className="mt-8 text-red-400 text-xs text-center" style={{ fontFamily: arabicFont }}>
              {error || userError || t.loadError}
            </p>
          ) : null}

          <div className={`mt-16 flex items-center gap-10 ${isAr ? 'flex-row-reverse' : ''}`}>
            {step > 1 ? (
              <button
                onClick={() => setStep((value) => value - 1)}
                className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors"
                style={{ fontFamily: arabicFont }}
              >
                {t.back}
              </button>
            ) : null}
            <button
              onClick={() => step < 4 ? setStep((value) => value + 1) : saveProfile()}
              disabled={!canAdvance || loading}
              className="text-white text-[10px] uppercase tracking-[0.3em] border-b border-transparent hover:border-white/60 transition-all duration-300 disabled:opacity-25 disabled:cursor-not-allowed pb-0.5"
              style={{ fontFamily: arabicFont }}
            >
              {loading ? t.saving : step === 4 ? t.finish : t.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
