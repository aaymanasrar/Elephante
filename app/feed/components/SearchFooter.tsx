'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { ChangeEvent, ClipboardEvent, DragEvent, ReactNode, RefObject } from 'react'
import type { WardrobeAttachment } from '@/hooks/useWardrobeAttachment'
import { useLocale } from '@/lib/locale-context'

type AttachmentAnalysis = {
  outfit_name?: string
  pieces?: string[]
  color_names?: string[]
  key_colors?: string[]
  color_scheme?: string
}

type AttachmentAnalysisMode = 'inventory' | 'rating'

function visibleLabels(values: Array<string | undefined>) {
  const seen = new Set<string>()
  return values.filter((value): value is string => {
    if (!value?.trim()) return false
    const label = value.trim()
    const normalized = label.toLowerCase()
    if (['null', 'none', 'n/a', 'na'].includes(normalized) || normalized.includes('not visible') || normalized.includes('not shown')) return false
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

interface SearchFooterProps {
  attachment: WardrobeAttachment | null
  attachmentAnalysis?: AttachmentAnalysis | null
  attachmentAnalysisMode?: AttachmentAnalysisMode | null
  clearAttachment: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  handleAttachment: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  handleAttachmentFile: (file: File) => Promise<void>
  inputValue: string
  isAnalyzingAttachment?: boolean
  isThinking: boolean
  keyboardOffset: number
  onAnalyzeAttachment?: () => void
  onInputChange: (value: string) => void
  onRateAttachment?: () => void
  onFindSimilar?: () => void
  onRestyle?: () => void
  placeholderOverlay?: ReactNode
  onSubmit: () => void
}

export default function SearchFooter({
  attachment,
  attachmentAnalysis,
  attachmentAnalysisMode,
  clearAttachment,
  fileInputRef,
  handleAttachment,
  handleAttachmentFile,
  inputValue,
  isAnalyzingAttachment = false,
  isThinking,
  keyboardOffset,
  onAnalyzeAttachment,
  onInputChange,
  onRateAttachment,
  onFindSimilar,
  onRestyle,
  placeholderOverlay,
  onSubmit,
}: SearchFooterProps) {
  const { isAr } = useLocale()
  const [draggingPhoto, setDraggingPhoto] = useState(false)
  const copy = isAr ? {
    identifying: 'جارٍ التنظيف...',
    checking: 'جارٍ التحليل...',
    detected: 'ما وجدته',
    styleCheck: 'تحليل الإطلالة',
    checkAgain: 'أعد التحليل',
    removePhoto: 'إزالة صورة الملابس',
    attachPhoto: 'إرفاق صورة ملابس',
    uploadPhoto: 'رفع صورة ملابس',
    dropPhoto: 'اترك الصورة هنا',
    readyToAnalyze: 'جاهز للتحليل',
    search: 'بحث',
  } : {
    identifying: 'Polishing...',
    checking: 'Checking...',
    detected: 'What I see',
    styleCheck: 'Style Check',
    checkAgain: 'Check Again',
    removePhoto: 'Remove uploaded clothing photo',
    attachPhoto: 'Attach clothing photo',
    uploadPhoto: 'Upload clothing photo',
    dropPhoto: 'Drop photo here',
    readyToAnalyze: 'Ready to analyze',
    search: 'Search',
  }
  const canUseAttachment = Boolean(attachment?.image_url && !attachment.uploading)
  const canSubmit = (!attachment?.uploading && Boolean(inputValue.trim())) || canUseAttachment
  const detectedPieces = visibleLabels(attachmentAnalysis?.pieces || [])
  const uploadedPieces = visibleLabels(attachment?.pieces || [])
  const fallbackTags = attachment?.tags
    .filter((tag) => tag.label && !['Color', 'Occasion'].includes(tag.label))
    .map((tag) => tag.label)
  const visibleDetections = detectedPieces.length
    ? detectedPieces
    : uploadedPieces.length
      ? uploadedPieces
      : visibleLabels([attachment?.item_name, ...(fallbackTags || [])])
  const hexColors = (attachmentAnalysis?.key_colors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c))
  const actionLabel = isAnalyzingAttachment
    ? copy.checking
    : attachmentAnalysisMode
      ? copy.checkAgain
      : copy.styleCheck
  const actionHandler = attachmentAnalysisMode === 'rating' ? onAnalyzeAttachment : onRateAttachment
  const attachmentImageSrc = attachment?.image_url || ''
  const firstImageFile = (files: FileList | File[]) => {
    return Array.from(files).find((file) => file.type.startsWith('image/')) || null
  }
  const clipboardImageFile = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedFile = firstImageFile(event.clipboardData.files)
    if (pastedFile) return pastedFile

    const imageItem = Array.from(event.clipboardData.items).find((item) => item.kind === 'file' && item.type.startsWith('image/'))
    return imageItem?.getAsFile() || null
  }
  const hasImageFile = (event: DragEvent<HTMLElement>) => {
    return Array.from(event.dataTransfer.items || []).some((item) => item.kind === 'file' && item.type.startsWith('image/'))
      || Array.from(event.dataTransfer.files || []).some((file) => file.type.startsWith('image/'))
  }
  const attachDroppedPhoto = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDraggingPhoto(false)
    const file = firstImageFile(event.dataTransfer.files)
    if (file) await handleAttachmentFile(file)
  }
  const attachPastedPhoto = async (event: ClipboardEvent<HTMLInputElement>) => {
    const file = clipboardImageFile(event)
    if (!file) return
    event.preventDefault()
    event.stopPropagation()
    await handleAttachmentFile(file)
  }

  return (
    <div
      className="fixed left-0 right-0 z-50 pt-5 px-4"
      style={{
        bottom: keyboardOffset > 0 ? keyboardOffset : 0,
        paddingBottom: keyboardOffset > 0 ? '0.75rem' : 'max(1.25rem, env(safe-area-inset-bottom))',
        transition: 'bottom 120ms ease-out',
      }}
      onDragEnter={(event) => {
        if (!hasImageFile(event)) return
        event.preventDefault()
        setDraggingPhoto(true)
      }}
      onDragOver={(event) => {
        if (!hasImageFile(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDraggingPhoto(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDraggingPhoto(false)
      }}
      onDrop={attachDroppedPhoto}
    >
      <div className="relative max-w-md mx-auto">
        {draggingPhoto ? (
          <div className="absolute inset-x-0 bottom-0 z-20 min-h-[72px] rounded-[1.75rem] border border-white/30 bg-white/10 backdrop-blur-xl shadow-[0_0_40px_rgba(255,255,255,0.08)] flex items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-[0.28em] text-white/85">{copy.dropPhoto}</span>
          </div>
        ) : null}

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
                {attachmentImageSrc ? (
                  <Image src={attachmentImageSrc} alt="" fill className="object-contain bg-zinc-950" unoptimized aria-hidden="true" />
                ) : (
                  <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-zinc-500" aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <path d="M17 8l-5-5-5 5" />
                      <path d="M12 3v12" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {attachment.uploading ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border border-white/20 border-t-white/80 rounded-full animate-spin" />
                    <span className="text-zinc-400 text-xs">{copy.identifying}</span>
                  </div>
                ) : attachment.error ? (
                  <p className="text-red-400 text-xs leading-snug">{attachment.error}</p>
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

            {!attachment.uploading && !attachment.error ? (
              <>
                <div className="space-y-2">
                  <p className="text-[8px] uppercase tracking-[0.28em] text-zinc-600">{copy.detected}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleDetections.length ? visibleDetections.map((label, index) => (
                      <span key={`${label}-${index}`} className="px-2.5 py-1 rounded-full border border-zinc-800 bg-black/25 text-[10px] text-zinc-300">
                        {label}
                      </span>
                    )) : (
                      <span className="px-2.5 py-1 rounded-full border border-zinc-800 bg-black/25 text-[10px] text-zinc-500">
                        {copy.readyToAnalyze}
                      </span>
                    )}
                    {hexColors.length > 0 ? (
                      <div className="flex items-center gap-1.5 ml-0.5">
                        {hexColors.slice(0, 5).map((hex, i) => (
                          <div
                            key={`${hex}-${i}`}
                            className="w-4 h-4 rounded-full border border-zinc-700/60 flex-shrink-0"
                            style={{ backgroundColor: hex }}
                            title={attachmentAnalysis?.color_names?.[i] || hex}
                          />
                        ))}
                      </div>
                    ) : attachmentAnalysis?.color_names?.length ? attachmentAnalysis.color_names.slice(0, 3).map((color) => (
                      <span key={color} className="px-2.5 py-1 rounded-full border border-zinc-800 bg-black/25 text-[10px] text-zinc-400">
                        {color}
                      </span>
                    )) : null}
                  </div>
                </div>
                <button
                  onClick={actionHandler}
                  disabled={!canUseAttachment || isAnalyzingAttachment || !actionHandler}
                  className="w-full rounded-full bg-white text-black text-[10px] uppercase tracking-[0.2em] py-2.5 hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLabel}
                </button>

                {(onFindSimilar || onRestyle) && !attachmentAnalysisMode ? (
                  <div className="flex gap-2">
                    {onFindSimilar ? (
                      <button
                        onClick={onFindSimilar}
                        disabled={!canUseAttachment || isAnalyzingAttachment}
                        className="flex-1 rounded-full border border-zinc-700 text-zinc-300 text-[10px] uppercase tracking-[0.12em] py-2 hover:border-white hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isAr ? 'مشابهة ←' : 'Similar looks →'}
                      </button>
                    ) : null}
                    {onRestyle ? (
                      <button
                        onClick={onRestyle}
                        disabled={!canUseAttachment || isAnalyzingAttachment}
                        className="flex-1 rounded-full border border-zinc-700 text-zinc-300 text-[10px] uppercase tracking-[0.12em] py-2 hover:border-white hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isAr ? 'أعد التنسيق' : 'Restyle it'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        <div className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : ''}`}>
          <button
            id="tour-camera"
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
              onPaste={attachPastedPhoto}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canSubmit) onSubmit()
              }}
              className={`w-full bg-zinc-950/50 backdrop-blur-md border border-white/10 text-white text-base sm:text-sm rounded-3xl py-4 outline-none focus:ring-2 focus:ring-white/20 focus:border-white/25 transition-[border-color,box-shadow,background-color] duration-300 min-h-[56px] placeholder-transparent shadow-[0_12px_36px_rgba(0,0,0,0.22)] ${isAr ? 'pr-6 pl-14 text-right' : 'pl-6 pr-14 text-left'}`}
              style={inputValue ? { boxShadow: '0 0 24px rgba(255,255,255,0.08), 0 12px 36px rgba(0,0,0,0.22)' } : {}}
              placeholder=" "
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={isAr ? 'ابحث عن إطلالات' : 'Search for outfits'}
            />
            {canSubmit && !isThinking && !isAnalyzingAttachment ? (
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
            {isThinking || isAnalyzingAttachment ? (
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
