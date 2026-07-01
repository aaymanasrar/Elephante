'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ParticleCanvas from '@/components/ParticleCanvas'
import Logo from '@/components/Logo'
import { useLocale } from '@/lib/locale-context'
import { useRequireUser } from '@/hooks/useRequireUser'
import { supabase } from '@/lib/supabase'

type StyleMode = 'street' | 'smart-casual' | 'formal' | 'casual' | 'athleisure' | 'y2k'

const STYLES: { key: StyleMode; label: string; labelAr: string; vibe: string }[] = [
  { key: 'street', label: 'Street Wear', labelAr: 'ملابس الشارع', vibe: 'urban streetwear, hypebeast, oversized silhouettes, bold graphic tees, cargo pants, chunky sneakers' },
  { key: 'smart-casual', label: 'Smart Casual', labelAr: 'كاجوال أنيق', vibe: 'smart casual, polished relaxed, tailored separates' },
  { key: 'formal', label: 'Formal', labelAr: 'رسمي', vibe: 'formal business, sharp tailoring, elegant and sophisticated' },
  { key: 'casual', label: 'Casual', labelAr: 'كاجوال', vibe: 'relaxed everyday casual, comfortable, effortless' },
  { key: 'athleisure', label: 'Athleisure', labelAr: 'رياضي', vibe: 'athletic luxury, sports-luxe, performance meets fashion' },
  { key: 'y2k', label: 'Y2K', labelAr: 'طراز الألفية', vibe: 'Y2K aesthetic, 2000s nostalgia, bold metallic accents, low-rise, crop tops' },
]

type SlotKey = 'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessories'

const SLOTS: { key: SlotKey; label: string; labelAr: string; placeholder: string; placeholderAr: string }[] = [
  { key: 'top', label: 'Top', labelAr: 'علوي', placeholder: 'White graphic tee, oversized hoodie...', placeholderAr: 'تيشيرت أبيض، هودي واسع...' },
  { key: 'bottom', label: 'Bottom', labelAr: 'سفلي', placeholder: 'Black cargo pants, baggy jeans...', placeholderAr: 'بنطال كارغو، جينز فضفاض...' },
  { key: 'shoes', label: 'Shoes', labelAr: 'أحذية', placeholder: 'Jordan 1s, Air Force, Yeezys...', placeholderAr: 'جوردن، نايك، أديداس...' },
  { key: 'outerwear', label: 'Outer', labelAr: 'طبقة خارجية', placeholder: 'Bomber jacket, puffer, coach...', placeholderAr: 'جاكيت بومبر، بافر...' },
  { key: 'accessories', label: 'Extras', labelAr: 'إضافات', placeholder: 'Beanie, chain, bucket hat...', placeholderAr: 'قبعة، سلسلة...' },
]

type SlotValues = Record<SlotKey, string>

interface ClosetItem {
  id: number
  item_name: string | null
  item_type: string | null
  category: string
  image_url: string | null
}

function OutfitBuilderContent() {
  const router = useRouter()
  const { isAr } = useLocale()
  const { user, loading: authLoading } = useRequireUser('/login')

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarLabel, setAvatarLabel] = useState('Default Memoji')
  const [snapUsername, setSnapUsername] = useState('')
  const [snapLoading, setSnapLoading] = useState(false)
  const [snapError, setSnapError] = useState('')

  const [slotValues, setSlotValues] = useState<SlotValues>({ top: '', bottom: '', shoes: '', outerwear: '', accessories: '' })
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null)
  const [style, setStyle] = useState<StyleMode>('street')

  const [generating, setGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState('')

  const [closetItems, setClosetItems] = useState<ClosetItem[]>([])
  const [userGender, setUserGender] = useState('male')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, gender')
        .eq('id', user.id)
        .single()

      const gender = profile?.gender || 'male'
      setUserGender(gender)
      setAvatarUrl(profile?.avatar_url || (gender === 'female' ? '/images/FF01.png' : '/images/MF01.png'))

      const { data: items } = await supabase
        .from('closet_items')
        .select('id, item_name, item_type, category, image_url')
        .order('created_at', { ascending: false })
        .limit(60)
      if (items) setClosetItems(items)
    }
    load()
  }, [user])

  const handleSnapImport = useCallback(async () => {
    const username = snapUsername.trim().replace('@', '')
    if (!username) return
    setSnapLoading(true)
    setSnapError('')
    try {
      const res = await fetch(`/api/snapchat-avatar?username=${encodeURIComponent(username)}`)
      const data = await res.json()
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl)
        setAvatarLabel(`@${username}`)
        setGeneratedImage(null)
      } else {
        setSnapError(data.error || 'Could not find Snapchat avatar')
      }
    } catch {
      setSnapError('Import failed — check the username and try again.')
    } finally {
      setSnapLoading(false)
    }
  }, [snapUsername])

  const handleGenerate = useCallback(async () => {
    const selectedStyle = STYLES.find(s => s.key === style)!
    const hasAny = Object.values(slotValues).some(v => v.trim())
    if (!hasAny || generating) return

    setGenerating(true)
    setGenerateError('')
    setGeneratedImage(null)

    try {
      const outfit = {
        style: selectedStyle.label,
        vibe: selectedStyle.vibe,
        outfit_name: `${selectedStyle.label} Look`,
        pieces: {
          top: slotValues.top ? { item: slotValues.top } : undefined,
          bottom: slotValues.bottom ? { item: slotValues.bottom } : undefined,
          shoes: slotValues.shoes ? { item: slotValues.shoes } : undefined,
          outerwear: slotValues.outerwear ? { item: slotValues.outerwear } : undefined,
          accessories: slotValues.accessories ? { item: slotValues.accessories } : undefined,
        },
      }
      const res = await fetch('/api/generate-outfit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outfit, profile: { gender: userGender } }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.image) setGeneratedImage(data.image)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [style, slotValues, userGender, generating])

  const slotCategories: Record<SlotKey, string[]> = {
    top: ['top', 'tops', 'shirt', 'sweater', 'tee', 'hoodie', 'blouse', 'polo'],
    bottom: ['bottom', 'bottoms', 'pants', 'jeans', 'trousers', 'skirt', 'shorts'],
    shoes: ['shoes', 'shoe', 'footwear', 'sneakers', 'boots', 'heels', 'loafers'],
    outerwear: ['outerwear', 'jacket', 'coat', 'blazer', 'hoodie', 'puffer', 'bomber'],
    accessories: ['accessories', 'accessory', 'bag', 'hat', 'belt', 'scarf', 'jewelry'],
  }

  const pickerItems = activeSlot
    ? closetItems.filter(item => {
        const cat = `${item.category} ${item.item_type || ''}`.toLowerCase()
        return slotCategories[activeSlot].some(k => cat.includes(k))
      })
    : []

  const hasAny = Object.values(slotValues).some(v => v.trim())
  const currentDisplay = generatedImage || avatarUrl

  if (authLoading) {
    return (
      <div className="bg-black" style={{ height: '100dvh' }}>
        <ParticleCanvas desktopCount={24} mobileCount={16} />
        <div className="flex items-center justify-center h-full">
          <Logo size={48} opacity={0.2} className="animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black text-white font-sans" style={{ minHeight: '100dvh' }} dir={isAr ? 'rtl' : 'ltr'}>
      <ParticleCanvas desktopCount={36} mobileCount={24} />

      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
          paddingBottom: '0.75rem',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)',
        }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors active:scale-95 min-w-[44px] min-h-[44px] justify-center"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isAr ? 'scaleX(-1)' : 'none' }}>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="text-[9px] uppercase tracking-[0.32em] text-zinc-600">
          {isAr ? 'منشئ الإطلالة' : 'Outfit Builder'}
        </span>
        <div className="w-[44px]" />
      </div>

      {/* Scrollable content */}
      <div
        className="relative z-10 px-4 pb-36"
        style={{ paddingTop: 'calc(max(1.5rem, env(safe-area-inset-top)) + 52px)' }}
      >
        <div className="max-w-md mx-auto space-y-4">

          {/* ── Avatar Card ── */}
          <div className="rounded-3xl overflow-hidden border border-white/8 shadow-[0_24px_64px_rgba(0,0,0,0.6)] bg-zinc-950/70 backdrop-blur-xl">
            {/* Image area */}
            <div className="relative bg-zinc-900/80" style={{ aspectRatio: '3/4', minHeight: '300px' }}>
              <p className="absolute top-4 left-4 z-10 text-[8px] uppercase tracking-[0.32em] text-white/40 select-none">
                {isAr ? 'الصورة الافتراضية' : 'Virtual Try-On Avatar'}
              </p>

              {generating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                  <Logo size={40} className="text-zinc-700 animate-pulse" />
                  <p className="text-[9px] uppercase tracking-[0.28em] text-zinc-600 animate-pulse">
                    {isAr ? 'جارٍ تصميم إطلالتك...' : 'Styling your look...'}
                  </p>
                </div>
              ) : currentDisplay ? (
                <img
                  src={currentDisplay}
                  alt={avatarLabel}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-zinc-800">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                      <circle cx="12" cy="7" r="4" />
                      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                    </svg>
                    <span className="text-[8px] uppercase tracking-widest">Your avatar</span>
                  </div>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/85 to-transparent">
                <p className="text-[11px] text-white/70 font-medium">
                  {generatedImage ? (STYLES.find(s => s.key === style)?.label || 'Generated Look') : avatarLabel}
                </p>
              </div>

              {generatedImage && (
                <button
                  onClick={() => setGeneratedImage(null)}
                  className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full bg-black/60 border border-white/12 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Snapchat Import */}
            <div className="px-4 py-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#FFFC00] flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(255,252,0,0.3)]">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="#000">
                    <path d="M12.065 2C8.784 2 6.177 4.58 6.177 7.827v.62c0 .266-.033.528-.099.784l-.77 3.014a.244.244 0 01-.222.175c-.383.022-.983-.02-1.454-.357-.156-.11-.33-.16-.5-.16-.403 0-.78.285-.897.695-.155.543.149 1.103.698 1.27.098.03.2.05.305.062.55.065 1.302.438 1.492 1.012.026.08.035.16.025.238-.012.087-.072.166-.17.215-.573.285-1.226.462-1.897.524-.287.026-.496.262-.496.547 0 .55.54 1.144 1.65 1.395.246.057.41.284.385.531-.01.098-.027.237-.044.37-.025.196.102.381.297.429 1.36.334 2.865 1.93 4.604 1.93 1.74 0 3.244-1.596 4.604-1.93.195-.048.322-.233.297-.43-.017-.133-.034-.27-.044-.37-.025-.246.139-.473.385-.53 1.11-.251 1.65-.845 1.65-1.396 0-.285-.209-.52-.496-.547-.67-.062-1.324-.24-1.897-.524-.098-.049-.158-.128-.17-.215-.01-.078-.001-.158.025-.238.19-.574.942-.947 1.492-1.012.105-.012.207-.032.305-.062.55-.167.853-.727.698-1.27-.117-.41-.494-.695-.897-.695-.17 0-.344.05-.5.16-.471.337-1.07.38-1.454.357a.244.244 0 01-.222-.175l-.77-3.014a2.735 2.735 0 01-.099-.784v-.62C17.954 4.58 15.346 2 12.065 2z" />
                  </svg>
                </div>
                <span className="text-[8px] uppercase tracking-[0.3em] text-zinc-500">
                  {isAr ? 'استيراد من سناب شات' : 'Import from Snapchat'}
                </span>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-[12px] select-none">@</span>
                  <input
                    value={snapUsername}
                    onChange={e => { setSnapUsername(e.target.value); setSnapError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') void handleSnapImport() }}
                    placeholder={isAr ? 'اسم المستخدم...' : 'Snapchat username...'}
                    className="w-full bg-zinc-900/60 border border-white/8 rounded-2xl pl-7 pr-3 py-2.5 text-[12px] text-white placeholder-zinc-700 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={handleSnapImport}
                  disabled={snapLoading || !snapUsername.trim()}
                  className="px-4 py-2.5 rounded-2xl bg-[#FFFC00] text-black text-[11px] font-bold tracking-wide hover:bg-yellow-300 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-[0_0_16px_rgba(255,252,0,0.2)]"
                >
                  {snapLoading ? (
                    <span className="w-3 h-3 border border-black/30 border-t-black/80 rounded-full animate-spin inline-block" />
                  ) : (isAr ? 'استيراد' : 'Import')}
                </button>
              </div>
              {snapError ? <p className="mt-1.5 text-[10px] text-red-400">{snapError}</p> : null}
            </div>
          </div>

          {/* ── Style selector ── */}
          <div className="space-y-2.5">
            <p className="text-[8px] uppercase tracking-[0.32em] text-zinc-600 px-1">
              {isAr ? 'النمط' : 'Style'}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {STYLES.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setStyle(opt.key)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-full text-[11px] transition-all duration-200 active:scale-95 ${
                    style === opt.key
                      ? 'bg-white text-black font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                      : 'border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {isAr ? opt.labelAr : opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Outfit Slots ── */}
          <div className="space-y-2.5">
            <p className="text-[8px] uppercase tracking-[0.32em] text-zinc-600 px-1">
              {isAr ? 'قطع الإطلالة' : 'Build Your Look'}
            </p>
            <div className="space-y-1.5">
              {SLOTS.map(slot => (
                <div key={slot.key}>
                  <button
                    onClick={() => setActiveSlot(activeSlot === slot.key ? null : slot.key)}
                    className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all duration-200 text-left ${
                      activeSlot === slot.key
                        ? 'border-white/15 bg-zinc-900/80'
                        : 'border-white/5 bg-zinc-950/40 hover:border-white/10 hover:bg-zinc-950/60'
                    }`}
                    dir={isAr ? 'rtl' : 'ltr'}
                  >
                    <div className="flex-1 min-w-0 text-left" style={{ textAlign: isAr ? 'right' : 'left' }}>
                      <p className="text-[8px] uppercase tracking-[0.22em] text-zinc-600 mb-0.5">
                        {isAr ? slot.labelAr : slot.label}
                      </p>
                      {slotValues[slot.key] ? (
                        <p className="text-[12px] text-white truncate">{slotValues[slot.key]}</p>
                      ) : (
                        <p className="text-[12px] text-zinc-700">{isAr ? slot.placeholderAr : slot.placeholder}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {slotValues[slot.key] ? (
                        <span
                          role="button"
                          onClick={e => { e.stopPropagation(); setSlotValues(prev => ({ ...prev, [slot.key]: '' })) }}
                          className="text-zinc-700 hover:text-white transition-colors p-1"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </span>
                      ) : null}
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-zinc-700 transition-transform duration-200 ${activeSlot === slot.key ? 'rotate-45 text-white' : ''}`}
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded editor */}
                  {activeSlot === slot.key && (
                    <div className="mx-1 mt-1 p-3 rounded-2xl bg-zinc-950/80 border border-white/6 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                      <input
                        autoFocus
                        value={slotValues[slot.key]}
                        onChange={e => setSlotValues(prev => ({ ...prev, [slot.key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') setActiveSlot(null) }}
                        placeholder={isAr ? slot.placeholderAr : slot.placeholder}
                        className="w-full bg-zinc-900/60 border border-white/8 rounded-xl px-3 py-2.5 text-[12px] text-white placeholder-zinc-700 outline-none focus:border-white/20 transition-all"
                        dir={isAr ? 'rtl' : 'ltr'}
                      />

                      {pickerItems.length > 0 && (
                        <div>
                          <p className="text-[7px] uppercase tracking-[0.28em] text-zinc-700 mb-2">
                            {isAr ? 'من خزانتك' : 'From your closet'}
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {pickerItems.slice(0, 8).map(item => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setSlotValues(prev => ({ ...prev, [slot.key]: item.item_name || item.item_type || '' }))
                                  setActiveSlot(null)
                                }}
                                className="flex-shrink-0 w-14 flex flex-col items-center gap-1 group"
                              >
                                <div className="w-14 h-14 rounded-xl overflow-hidden border border-zinc-800/80 group-hover:border-zinc-500 transition-colors bg-zinc-900">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-800 text-xs">?</div>
                                  )}
                                </div>
                                <span className="text-[8px] text-zinc-700 group-hover:text-zinc-400 transition-colors leading-tight text-center max-w-[56px] truncate">
                                  {item.item_name || item.item_type || '—'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => setActiveSlot(null)}
                        className="w-full py-1.5 text-[9px] uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-300 transition-colors"
                      >
                        {isAr ? 'تم ✓' : 'Done ✓'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {generateError ? (
            <p className="text-[11px] text-red-400 px-1 text-center">{generateError}</p>
          ) : null}

        </div>
      </div>

      {/* ── Fixed Generate Button ── */}
      <div
        className="fixed left-0 right-0 z-50 px-4"
        style={{
          bottom: 0,
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          paddingTop: '2.5rem',
          background: 'linear-gradient(to top, rgba(0,0,0,0.97) 55%, transparent 100%)',
        }}
      >
        <div className="max-w-md mx-auto">
          <button
            onClick={handleGenerate}
            disabled={generating || !hasAny}
            className="w-full py-4 rounded-3xl bg-white text-black text-[11px] font-bold uppercase tracking-[0.28em] hover:bg-zinc-100 active:scale-[0.98] transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed shadow-[0_8px_32px_rgba(255,255,255,0.12)]"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2.5">
                <span className="w-3.5 h-3.5 border-[1.5px] border-black/25 border-t-black/80 rounded-full animate-spin" />
                {isAr ? 'جارٍ التصميم...' : 'Generating look...'}
              </span>
            ) : (
              isAr ? 'ولّد الإطلالة ←' : 'Generate Look →'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OutfitBuilderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <OutfitBuilderContent />
    </Suspense>
  )
}
