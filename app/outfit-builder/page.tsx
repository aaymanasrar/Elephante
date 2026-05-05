'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRequireUser } from '@/hooks/useRequireUser'
import ParticleCanvas from '@/components/ParticleCanvas'
import { useLocale } from '@/lib/locale-context'

type InputMode = 'prompt' | 'url' | 'photo' | null

interface ZoneItem {
  label: string
  preview: string | null  // image data-url or url
  file: File | null
  prompt: string
  inputMode: InputMode
  inputDraft: string
}

type ZoneKey = 'top' | 'outerwear' | 'bottom' | 'shoes' | 'accessories'

const ZONES: { key: ZoneKey; label: string; emoji: string; hint: string }[] = [
  { key: 'top',         label: 'Top',         emoji: '👕', hint: 'Shirt, tee, blouse…' },
  { key: 'outerwear',   label: 'Outerwear',   emoji: '🧥', hint: 'Jacket, coat, blazer…' },
  { key: 'bottom',      label: 'Bottom',      emoji: '👖', hint: 'Pants, skirt, shorts…' },
  { key: 'shoes',       label: 'Shoes',       emoji: '👟', hint: 'Sneakers, boots, heels…' },
  { key: 'accessories', label: 'Accessories', emoji: '💍', hint: 'Watch, bag, hat…' },
]

const ZONE_AR: Record<ZoneKey, { label: string; hint: string }> = {
  top: { label: 'علوي', hint: 'قميص، تيشيرت، بلوزة...' },
  outerwear: { label: 'طبقة خارجية', hint: 'جاكيت، معطف، بليزر...' },
  bottom: { label: 'سفلي', hint: 'بنطال، تنورة، شورت...' },
  shoes: { label: 'أحذية', hint: 'سنيكرز، بوت، كعب...' },
  accessories: { label: 'إكسسوارات', hint: 'ساعة، حقيبة، قبعة...' },
}

const builderCopy = {
  en: {
    back: 'Back',
    title: 'Outfit Builder',
    save: 'Save',
    clear: 'Clear',
    uploadPhoto: 'Upload photo',
    pasteUrl: 'Paste URL',
    describe: 'Describe it',
    pasteProductUrl: 'Paste any product URL...',
    describeYour: (label: string) => `Describe your ${label.toLowerCase()}...`,
    add: 'Add',
    tapZone: 'Tap a zone to style it',
    consulting: 'Consulting AI Stylist...',
    rate: 'Rate This Outfit!',
    uploadBoth: 'Upload Top + Bottom Photos',
    verdict: 'AI Stylist Verdict',
    match: 'Match',
    strong: 'Absolutely amazing. These pieces were made for each other.',
    weak: 'Hmm. You might want to rethink this combination.',
    uploadError: 'Upload photos for both Top and Bottom to test the outfit.',
    failed: 'Failed to test outfit match.',
  },
  ar: {
    back: 'رجوع',
    title: 'منسق الإطلالة',
    save: 'حفظ',
    clear: 'مسح',
    uploadPhoto: 'رفع صورة',
    pasteUrl: 'إضافة رابط',
    describe: 'وصف القطعة',
    pasteProductUrl: 'الصق رابط المنتج...',
    describeYour: (label: string) => `صف قطعة ${label}...`,
    add: 'إضافة',
    tapZone: 'اضغط على جزء لتنسيقه',
    consulting: 'جارٍ استشارة AI Stylist...',
    rate: 'قيّم هذه الإطلالة',
    uploadBoth: 'ارفع صورة العلوي والسفلي',
    verdict: 'AI Stylist Verdict',
    match: 'توافق',
    strong: 'ممتازة جداً. القطع كأنها صنعت لبعضها.',
    weak: 'قد تحتاج إلى إعادة التفكير في هذا التنسيق.',
    uploadError: 'ارفع صورتي الجزء العلوي والسفلي لاختبار الإطلالة.',
    failed: 'تعذّر اختبار توافق الإطلالة.',
  },
} as const

const EMPTY_ZONE = (): ZoneItem => ({
  label: '',
  preview: null,
  file: null,
  prompt: '',
  inputMode: null,
  inputDraft: '',
})

function MannequinSVG({ activeZone, onZoneClick }: {
  activeZone: ZoneKey | null
  onZoneClick: (z: ZoneKey) => void
}) {
  const zoneStyle = (z: ZoneKey) => ({
    fill: activeZone === z ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)',
    stroke: activeZone === z ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.18)',
    strokeWidth: activeZone === z ? 1.5 : 0.8,
    cursor: 'pointer',
    transition: 'all 0.2s',
  })

  return (
    <svg viewBox="0 0 120 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Head */}
      <ellipse cx="60" cy="22" rx="14" ry="17" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />

      {/* Neck */}
      <rect x="55" y="37" width="10" height="9" rx="2" fill="rgba(255,255,255,0.06)" />

      {/* Shoulders / Top zone */}
      <path
        d="M20 58 Q60 42 100 58 L98 105 Q60 112 22 105 Z"
        style={zoneStyle('top')}
        onClick={() => onZoneClick('top')}
      />
      {/* Arms */}
      <path d="M20 60 L8 100 Q10 108 18 106 L26 68 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
      <path d="M100 60 L112 100 Q110 108 102 106 L94 68 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />

      {/* Outerwear overlay zone (slightly wider, dashed) */}
      <path
        d="M14 56 Q60 39 106 56 L104 108 Q60 116 16 108 Z"
        fill="none"
        stroke={activeZone === 'outerwear' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.1)'}
        strokeWidth={activeZone === 'outerwear' ? 1.5 : 0.8}
        strokeDasharray="3 2"
        cursor="pointer"
        onClick={() => onZoneClick('outerwear')}
        style={{ transition: 'all 0.2s' }}
      />

      {/* Bottom zone */}
      <path
        d="M22 105 Q60 112 98 105 L96 175 Q60 182 24 175 Z"
        style={zoneStyle('bottom')}
        onClick={() => onZoneClick('bottom')}
      />

      {/* Left leg */}
      <path
        d="M24 175 L18 245 Q28 252 38 248 L44 178 Z"
        style={zoneStyle('shoes')}
        onClick={() => onZoneClick('shoes')}
      />
      {/* Right leg */}
      <path
        d="M96 175 L102 245 Q92 252 82 248 L76 178 Z"
        style={zoneStyle('shoes')}
        onClick={() => onZoneClick('shoes')}
      />

      {/* Left shoe */}
      <path
        d="M18 244 Q12 252 10 258 L40 258 Q44 252 38 246 Z"
        style={zoneStyle('shoes')}
        onClick={() => onZoneClick('shoes')}
      />
      {/* Right shoe */}
      <path
        d="M102 244 Q108 252 110 258 L80 258 Q76 252 82 246 Z"
        style={zoneStyle('shoes')}
        onClick={() => onZoneClick('shoes')}
      />

      {/* Accessories zone — collarbone area */}
      <ellipse
        cx="60" cy="52"
        rx="16" ry="6"
        style={zoneStyle('accessories')}
        onClick={() => onZoneClick('accessories')}
      />

      {/* Zone labels */}
      <text x="60" y="80" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="5" fontFamily="sans-serif">TOP</text>
      <text x="60" y="145" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="5" fontFamily="sans-serif">BOTTOM</text>
      <text x="28" y="220" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="4" fontFamily="sans-serif">SHOES</text>
      <text x="92" y="220" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="4" fontFamily="sans-serif">SHOES</text>
      <text x="60" y="53" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="3.5" fontFamily="sans-serif">ACC</text>
    </svg>
  )
}

function ZoneInput({
  zone,
  item,
  onChange,
  onPhotoSelect,
  onConfirm,
  onClear,
  isAr,
  copy,
}: {
  zone: { key: ZoneKey; label: string; hint: string; emoji: string }
  item: ZoneItem
  onChange: (patch: Partial<ZoneItem>) => void
  onPhotoSelect: () => void
  onConfirm: () => void
  onClear: () => void
  isAr: boolean
  copy: typeof builderCopy.en | typeof builderCopy.ar
}) {
  const hasContent = item.preview || item.prompt
  const label = isAr ? ZONE_AR[zone.key].label : zone.label
  const hint = isAr ? ZONE_AR[zone.key].hint : zone.hint

  return (
    <div className={`rounded-2xl border transition-all duration-200 ${hasContent ? 'border-zinc-600 bg-zinc-900/80' : 'border-zinc-800 bg-zinc-900/40'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base">{zone.emoji}</span>
          <div>
            <p className={`text-[11px] font-semibold text-white ${isAr ? '' : 'uppercase tracking-widest'}`}>{label}</p>
            {!hasContent && <p className="text-[10px] text-zinc-600">{hint}</p>}
            {item.prompt && !item.preview && <p className="text-[10px] text-zinc-400 truncate max-w-[160px]">{item.prompt}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasContent ? (
            <button
              onClick={onClear}
              className="text-zinc-600 hover:text-red-400 transition-colors p-1"
              aria-label={copy.clear}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <div className="flex gap-1">
              {/* Photo */}
              <button
                onClick={onPhotoSelect}
                className={`p-2 rounded-xl transition-all ${item.inputMode === 'photo' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-white'}`}
                title={copy.uploadPhoto}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              {/* URL */}
              <button
                onClick={() => onChange({ inputMode: item.inputMode === 'url' ? null : 'url', inputDraft: '' })}
                className={`p-2 rounded-xl transition-all ${item.inputMode === 'url' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-white'}`}
                title={copy.pasteUrl}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </button>
              {/* Prompt */}
              <button
                onClick={() => onChange({ inputMode: item.inputMode === 'prompt' ? null : 'prompt', inputDraft: '' })}
                className={`p-2 rounded-xl transition-all ${item.inputMode === 'prompt' ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-white'}`}
                title={copy.describe}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            </div>
          )}

          {/* Preview thumbnail */}
          {item.preview && (
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 ml-1 flex-shrink-0 relative">
              <img src={item.preview} alt={label} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Expanded input */}
      {(item.inputMode === 'url' || item.inputMode === 'prompt') && !hasContent && (
        <div className="px-4 pb-3 flex gap-2">
          <input
            type={item.inputMode === 'url' ? 'url' : 'text'}
            placeholder={item.inputMode === 'url' ? copy.pasteProductUrl : copy.describeYour(label)}
            value={item.inputDraft}
            onChange={(e) => onChange({ inputDraft: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && item.inputDraft.trim() && onConfirm()}
            autoFocus
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            onClick={onConfirm}
            disabled={!item.inputDraft.trim()}
            className="px-3 py-2 bg-white text-black rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 transition-opacity active:scale-95"
          >
            {copy.add}
          </button>
        </div>
      )}
    </div>
  )
}

export default function OutfitBuilder() {
  const router = useRouter()
  const { isAr } = useLocale()
  const copy = isAr ? builderCopy.ar : builderCopy.en
  const { user } = useRequireUser('/login')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const fileTargetZoneRef = useRef<ZoneKey | null>(null)
  const [activeZone, setActiveZone] = useState<ZoneKey | null>(null)
  const [matchScore, setMatchScore] = useState<number | null>(null)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [userSkinTone, setUserSkinTone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [zones, setZones] = useState<Record<ZoneKey, ZoneItem>>({
    top:         EMPTY_ZONE(),
    outerwear:   EMPTY_ZONE(),
    bottom:      EMPTY_ZONE(),
    shoes:       EMPTY_ZONE(),
    accessories: EMPTY_ZONE(),
  })

  useEffect(() => {
    if (!user) return

    const loadSkinTone = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('skin_tone')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Failed to load skin tone:', error)
        return
      }

      setUserSkinTone(data?.skin_tone || '')
    }

    loadSkinTone()
  }, [user])

  const patch = (key: ZoneKey, update: Partial<ZoneItem>) => {
    setZones((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }))
  }

  const handlePhotoSelect = (key: ZoneKey) => {
    fileTargetZoneRef.current = key
    setActiveZone(key)
    patch(key, { inputMode: 'photo', inputDraft: '' })
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetZone = fileTargetZoneRef.current || activeZone
    const file = e.target.files?.[0]
    if (!targetZone || !file) {
      e.target.value = ''
      fileTargetZoneRef.current = null
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      patch(targetZone, {
        preview: ev.target?.result as string,
        file,
        inputMode: null,
        inputDraft: '',
        label: file.name.replace(/\.[^/.]+$/, ''),
      })
      setMatchScore(null)
      setMatchError(null)
      fileTargetZoneRef.current = null
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleConfirm = (key: ZoneKey) => {
    const item = zones[key]
    if (!item.inputDraft.trim()) return
    if (item.inputMode === 'url') {
      patch(key, { preview: item.inputDraft.trim(), file: null, label: item.inputDraft.trim(), inputMode: null, inputDraft: '' })
    } else {
      patch(key, { prompt: item.inputDraft.trim(), file: null, label: item.inputDraft.trim(), inputMode: null, inputDraft: '' })
    }
    setMatchScore(null)
    setMatchError(null)
  }

  const handleClear = (key: ZoneKey) => {
    patch(key, EMPTY_ZONE())
    setMatchScore(null)
    setMatchError(null)
  }

  const checkOutfitMatch = async (shirtFile: File, pantsFile: File, userSkinTone: string) => {
    try {
      const aiUrl = process.env.NEXT_PUBLIC_AI_MODEL_URL
      if (!aiUrl) throw new Error('Missing NEXT_PUBLIC_AI_MODEL_URL')

      const formData = new FormData()
      formData.append('shirt_image', shirtFile)
      formData.append('pants_image', pantsFile)
      formData.append('skin_tone', userSkinTone || 'medium_neutral')

      const response = await fetch(aiUrl, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.status === 'success') {
        console.log(`The AI Match Score is: ${result.match_score}%`)
        return Number(result.match_score)
      }

      throw new Error(result.error || 'AI match check failed')
    } catch (error) {
      console.error('Failed to connect to the AI brain:', error)
      throw error
    }
  }

  const handleTestOutfit = async () => {
    const shirtFile = zones.top.file
    const pantsFile = zones.bottom.file

    if (!shirtFile || !pantsFile) {
      setMatchScore(null)
      setMatchError(copy.uploadError)
      return
    }

    setIsLoading(true)
    setMatchScore(null)
    setMatchError(null)

    try {
      const score = await checkOutfitMatch(shirtFile, pantsFile, userSkinTone)
      setMatchScore(score)
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : copy.failed)
    } finally {
      setIsLoading(false)
    }
  }

  const filledCount = Object.values(zones).filter((z) => z.preview || z.prompt).length
  const hasMatchPhotos = Boolean(zones.top.file && zones.bottom.file)

  return (
    <div className="min-h-[100dvh] bg-black text-white relative" dir={isAr ? 'rtl' : 'ltr'}>
      <ParticleCanvas />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-8 pb-4">
        <button
          onClick={() => router.back()}
          className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors min-h-[44px] flex items-center"
        >
          {isAr ? `${copy.back} →` : `← ${copy.back}`}
        </button>
        <h1 className="text-[11px] font-bold tracking-[0.4em] text-zinc-500 uppercase">{copy.title}</h1>
        {filledCount > 0 ? (
          <button className="text-[10px] uppercase tracking-widest text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors">
            {copy.save} ({filledCount})
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      <div className="relative z-10 px-4 pb-24 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-center">
        {/* Mannequin */}
        <div className="flex flex-col items-center">
          <div className="relative w-48 h-72 mx-auto">
            <MannequinSVG
              activeZone={activeZone}
              onZoneClick={(z) => setActiveZone((prev) => prev === z ? null : z)}
            />
            {/* Overlay previews on mannequin */}
            {zones.top.preview && (
              <div className="absolute top-[22%] left-[18%] w-[64%] h-[30%] rounded-lg overflow-hidden opacity-60 pointer-events-none">
                <img src={zones.top.preview} alt="top" className="w-full h-full object-cover" />
              </div>
            )}
            {zones.bottom.preview && (
              <div className="absolute top-[52%] left-[20%] w-[60%] h-[28%] rounded-lg overflow-hidden opacity-60 pointer-events-none">
                <img src={zones.bottom.preview} alt="bottom" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-700 mt-3 text-center">
            {copy.tapZone}
          </p>
        </div>

        {/* Zone inputs */}
        <div className="flex flex-col gap-3 lg:w-80 lg:pt-4">
          {ZONES.map((zone) => (
            <div
              key={zone.key}
              className={`transition-all duration-200 ${activeZone === zone.key ? 'ring-1 ring-white/20 rounded-2xl' : ''}`}
              onClick={() => !zones[zone.key].preview && !zones[zone.key].prompt && setActiveZone(zone.key)}
            >
              <ZoneInput
                zone={zone}
                item={zones[zone.key]}
                onChange={(update) => {
                  setActiveZone(zone.key)
                  patch(zone.key, update)
                }}
                onPhotoSelect={() => handlePhotoSelect(zone.key)}
                onConfirm={() => handleConfirm(zone.key)}
                onClear={() => handleClear(zone.key)}
                isAr={isAr}
                copy={copy}
              />
            </div>
          ))}

          {filledCount >= 2 && (
            <button
              onClick={handleTestOutfit}
              disabled={isLoading}
              className="w-full mt-2 py-4 bg-white text-black font-bold text-[10px] uppercase tracking-widest rounded-2xl hover:bg-zinc-100 transition-colors active:scale-[0.98] min-h-[52px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? copy.consulting : hasMatchPhotos ? copy.rate : copy.uploadBoth}
            </button>
          )}

          {matchScore !== null && (
            <div className="mt-4 p-4 border rounded bg-gray-50 text-center">
              <h3 className="text-xl font-bold text-gray-950">{copy.verdict}</h3>

              <p className="text-3xl font-extrabold text-blue-600 mt-2">
                {matchScore}% {copy.match}
              </p>

              <p className="mt-2 text-gray-600">
                {matchScore > 75
                  ? copy.strong
                  : copy.weak}
              </p>
            </div>
          )}

          {matchError && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
              <p className="text-xs text-red-300">{matchError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
