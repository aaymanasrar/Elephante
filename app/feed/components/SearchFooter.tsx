'use client'

import Image from 'next/image'
import type { ChangeEvent, ReactNode, RefObject } from 'react'
import type { WardrobeAttachment, WardrobeTag } from '@/hooks/useWardrobeAttachment'
import { useLocale } from '@/lib/locale-context'

interface SearchFooterProps {
  attachment: WardrobeAttachment | null
  clearAttachment: () => void
  confirmAttachment: () => Promise<void>
  fileInputRef: RefObject<HTMLInputElement | null>
  handleAttachment: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  inputValue: string
  isThinking: boolean
  keyboardOffset: number
  onInputChange: (value: string) => void
  onTagChange: (id: WardrobeTag['id'], label: string) => void
  placeholderOverlay?: ReactNode
  onSubmit: () => void
}

export default function SearchFooter({
  attachment,
  clearAttachment,
  confirmAttachment,
  fileInputRef,
  handleAttachment,
  inputValue,
  isThinking,
  keyboardOffset,
  onInputChange,
  onTagChange,
  placeholderOverlay,
  onSubmit,
}: SearchFooterProps) {
  const { isAr } = useLocale()
  const copy = isAr ? {
    identifying: 'جارٍ التعرّف...',
    saving: 'جارٍ الحفظ...',
    confirmTags: 'تأكيد الوسوم',
    removePhoto: 'إزالة صورة الملابس',
    attachPhoto: 'إرفاق صورة ملابس',
    uploadPhoto: 'رفع صورة ملابس',
    search: 'بحث',
  } : {
    identifying: 'Identifying...',
    saving: 'Saving...',
    confirmTags: 'Confirm Tags',
    removePhoto: 'Remove uploaded clothing photo',
    attachPhoto: 'Attach clothing photo',
    uploadPhoto: 'Upload clothing photo',
    search: 'Search',
  }

  return (
    <div
      className="fixed left-0 right-0 z-50 pt-5 px-4"
      style={{
        bottom: keyboardOffset > 0 ? keyboardOffset : 0,
        paddingBottom: keyboardOffset > 0 ? '0.75rem' : 'max(1.25rem, env(safe-area-inset-bottom))',
        transition: 'bottom 120ms ease-out',
      }}
    >
      <div className="relative max-w-md mx-auto">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAttachment}
          accept="image/*"
          className="hidden"
        />

        {attachment ? (
          <div className="mb-2.5 bg-zinc-950/55 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-3 space-y-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 relative">
                <Image src={attachment.preview} alt="" fill className="object-cover" unoptimized aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                {attachment.uploading ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border border-white/20 border-t-white/80 rounded-full animate-spin" />
                    <span className="text-zinc-400 text-xs">{copy.identifying}</span>
                  </div>
                ) : (
                  <p className="text-white text-xs truncate">{attachment.item_name}</p>
                )}
              </div>
              <button
                onClick={clearAttachment}
                className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                aria-label={copy.removePhoto}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!attachment.uploading ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {attachment.tags.map((tag) => (
                    <input
                      key={tag.id}
                      value={tag.label}
                      onChange={(event) => onTagChange(tag.id, event.target.value)}
                      className="px-3 py-1.5 rounded-full border border-zinc-800 bg-black/20 text-[11px] text-zinc-300 outline-none focus:border-zinc-600"
                      aria-label={isAr ? `وسم ${tag.id}` : `${tag.id} tag`}
                    />
                  ))}
                </div>
                <button
                  onClick={confirmAttachment}
                  disabled={attachment.confirming}
                  className="w-full rounded-full border border-zinc-700 text-zinc-300 text-[10px] uppercase tracking-[0.25em] py-2.5 hover:border-white hover:text-white transition-all disabled:opacity-50"
                >
                  {attachment.confirming ? copy.saving : copy.confirmTags}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={attachment?.uploading}
            className="cursor-pointer flex-shrink-0 w-[52px] h-[56px] rounded-3xl bg-zinc-950/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/25 disabled:opacity-40 transition-all duration-200 shadow-[0_12px_36px_rgba(0,0,0,0.22)]"
            title={copy.attachPhoto}
            aria-label={copy.uploadPhoto}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          <div className="relative flex-1">
            <div id="tour-search" className="absolute inset-0 rounded-3xl pointer-events-none" />
            {placeholderOverlay}
            <input
              type="text"
              dir={isAr ? 'rtl' : 'ltr'}
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && inputValue.trim()) onSubmit()
              }}
              className={`w-full bg-zinc-950/50 backdrop-blur-md border border-white/10 text-white text-base sm:text-sm rounded-3xl py-4 outline-none focus:ring-2 focus:ring-white/20 focus:border-white/25 transition-[border-color,box-shadow,background-color] duration-300 min-h-[56px] placeholder-transparent shadow-[0_12px_36px_rgba(0,0,0,0.22)] ${isAr ? 'pr-6 pl-14 text-right' : 'pl-6 pr-14 text-left'}`}
              style={inputValue ? { boxShadow: '0 0 24px rgba(255,255,255,0.08), 0 12px 36px rgba(0,0,0,0.22)' } : {}}
              placeholder=" "
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={isAr ? 'ابحث عن إطلالات' : 'Search for outfits'}
            />
            {inputValue.trim() && !isThinking ? (
              <button
                onClick={onSubmit}
                className={`cursor-pointer absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-9 h-9 rounded-2xl bg-white flex items-center justify-center transition-all duration-200 hover:bg-zinc-100 active:scale-90`}
                aria-label={copy.search}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isAr ? 'scaleX(-1)' : 'none' }}>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ) : null}
            {isThinking ? (
              <div className={`absolute ${isAr ? 'left-5' : 'right-5'} top-1/2 -translate-y-1/2 flex gap-[3px] items-center`} aria-hidden="true">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/25 animate-bounce" style={{ animationDelay: '240ms' }} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
