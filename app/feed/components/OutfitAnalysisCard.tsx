'use client'

import { useEffect, useState } from 'react'

type Analysis = {
  outfit_name?: string
  style?: string
  vibe?: string
  occasions?: string[]
  pieces?: string[]
  color_names?: string[]
  key_colors?: string[]
  rating_out_of_10?: number | null
  match_score?: number | null
  proportion_score?: number | null
  color_harmony_score?: number | null
  skin_tone_feedback?: string
  silhouette_feedback?: string
  overall_verdict?: string
  why_it_works?: string
  styling_tip?: string
}

function ScoreRing({ score, label, strokeClass }: { score: number; label: string; strokeClass: string }) {
  const [animated, setAnimated] = useState(0)
  const r = 24
  const c = 2 * Math.PI * r

  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 120)
    return () => clearTimeout(t)
  }, [score])

  const scoreColor = score >= 80 ? 'text-white' : score >= 60 ? 'text-zinc-300' : 'text-zinc-500'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-800" />
          <circle
            cx="28" cy="28" r={r}
            stroke="currentColor" strokeWidth="3.5" fill="transparent" strokeLinecap="round"
            className={`${strokeClass} transition-all duration-1000 ease-out`}
            style={{ strokeDasharray: c, strokeDashoffset: c * (1 - animated / 100) }}
          />
        </svg>
        <span className={`absolute text-[11px] font-semibold ${scoreColor}`}>{score}</span>
      </div>
      <p className="text-[8px] uppercase tracking-[0.25em] text-zinc-600 text-center">{label}</p>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-1 h-1 rounded-full bg-zinc-700 flex-shrink-0" />
        <p className="text-[8px] uppercase tracking-[0.28em] text-zinc-600">{label}</p>
      </div>
      {children}
    </div>
  )
}

function finalRatingOutOf10(analysis: Analysis) {
  const direct = Number(analysis.rating_out_of_10)
  if (Number.isFinite(direct)) {
    const normalized = direct > 10 ? direct / 10 : direct
    return Math.max(0, Math.min(10, Math.round(normalized * 10) / 10))
  }

  const scores = [analysis.match_score, analysis.proportion_score, analysis.color_harmony_score]
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
  if (!scores.length) return null
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length / 10
  return Math.max(0, Math.min(10, Math.round(average * 10) / 10))
}

export default function OutfitAnalysisCard({ analysis, isAr }: { analysis: Analysis; isAr?: boolean }) {
  const hasScores = [analysis.match_score, analysis.proportion_score, analysis.color_harmony_score].some((s) => s != null)
  const finalRating = finalRatingOutOf10(analysis)
  const pieces = (analysis.pieces || []).filter((p) => {
    const normalized = p.trim().toLowerCase()
    return normalized && !['null', 'none', 'n/a', 'na'].includes(normalized) && !normalized.includes('not visible') && !normalized.includes('not shown')
  })
  const hexColors = (analysis.key_colors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c))

  const t = isAr
    ? {
        match: 'التطابق',
        proportion: 'النسب',
        harmony: 'الانسجام',
        palette: 'لوحة الألوان',
        pieces: 'القطع',
        occasions: 'مناسبات',
        verdict: 'الحكم',
        why: 'لماذا ينجح',
        tip: 'نصيحة التنسيق',
        skin: 'لون البشرة',
        silhouette: 'الشكل',
        finalRating: 'التقييم النهائي',
      }
    : {
        match: 'Match',
        proportion: 'Proportion',
        harmony: 'Harmony',
        palette: 'Palette',
        pieces: 'Pieces',
        occasions: 'Occasions',
        verdict: 'Verdict',
        why: 'Why It Works',
        tip: 'Styling Tip',
        skin: 'Skin Tone',
        silhouette: 'Silhouette',
        finalRating: 'Final Rating',
      }

  return (
    <div
      className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 backdrop-blur-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      {(analysis.outfit_name || analysis.style) ? (
        <div className="px-4 pt-4 pb-3 border-b border-zinc-800/40">
          {analysis.style ? <p className="text-[8px] uppercase tracking-[0.3em] text-zinc-600 mb-0.5">{analysis.style}</p> : null}
          {analysis.outfit_name ? <p className="text-sm font-medium text-white leading-snug">{analysis.outfit_name}</p> : null}
          {analysis.vibe ? <p className="text-[10px] text-zinc-500 mt-0.5 italic">{analysis.vibe}</p> : null}
        </div>
      ) : null}

      {/* Score rings */}
      {hasScores ? (
        <div className="flex justify-around px-6 py-5 border-b border-zinc-800/40">
          {analysis.match_score != null ? (
            <ScoreRing score={analysis.match_score} label={t.match} strokeClass="text-white" />
          ) : null}
          {analysis.proportion_score != null ? (
            <ScoreRing score={analysis.proportion_score} label={t.proportion} strokeClass="text-zinc-400" />
          ) : null}
          {analysis.color_harmony_score != null ? (
            <ScoreRing score={analysis.color_harmony_score} label={t.harmony} strokeClass="text-zinc-500" />
          ) : null}
        </div>
      ) : null}

      <div className="px-4 py-4 space-y-4">
        {/* Color palette */}
        {hexColors.length > 0 ? (
          <Section label={t.palette}>
            <div className="flex gap-2.5 flex-wrap pl-2.5">
              {hexColors.map((hex, i) => (
                <div key={`${hex}-${i}`} className="flex flex-col items-center gap-1">
                  <div
                    className="w-7 h-7 rounded-full border border-zinc-700/60 shadow-sm"
                    style={{ backgroundColor: hex }}
                    title={analysis.color_names?.[i] || hex}
                  />
                  {analysis.color_names?.[i] ? (
                    <span className="text-[7px] text-zinc-600 text-center max-w-[32px] truncate">
                      {analysis.color_names[i]}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {/* Pieces */}
        {pieces.length > 0 ? (
          <Section label={t.pieces}>
            <div className="flex flex-wrap gap-1.5 pl-2.5">
              {pieces.map((piece, i) => (
                <span key={i} className="px-2.5 py-1 text-[10px] text-zinc-300 rounded-full border border-zinc-800 bg-black/20">
                  {piece}
                </span>
              ))}
            </div>
          </Section>
        ) : null}

        {/* Occasions */}
        {analysis.occasions?.length ? (
          <Section label={t.occasions}>
            <div className="flex flex-wrap gap-1.5 pl-2.5">
              {analysis.occasions.map((occ, i) => (
                <span key={i} className="px-2.5 py-1 text-[10px] text-zinc-500 rounded-full border border-zinc-800/50">
                  {occ}
                </span>
              ))}
            </div>
          </Section>
        ) : null}

        {/* Overall verdict */}
        {analysis.overall_verdict ? (
          <Section label={t.verdict}>
            <p className="text-[12px] text-zinc-200 leading-relaxed pl-2.5">{analysis.overall_verdict}</p>
          </Section>
        ) : null}

        {/* Why it works */}
        {analysis.why_it_works ? (
          <Section label={t.why}>
            <p className="text-[12px] text-zinc-400 leading-relaxed pl-2.5">{analysis.why_it_works}</p>
          </Section>
        ) : null}

        {/* Skin tone */}
        {analysis.skin_tone_feedback ? (
          <Section label={t.skin}>
            <p className="text-[12px] text-zinc-400 leading-relaxed pl-2.5">{analysis.skin_tone_feedback}</p>
          </Section>
        ) : null}

        {/* Silhouette */}
        {analysis.silhouette_feedback ? (
          <Section label={t.silhouette}>
            <p className="text-[12px] text-zinc-400 leading-relaxed italic pl-2.5">{analysis.silhouette_feedback}</p>
          </Section>
        ) : null}

        {/* Styling tip */}
        {analysis.styling_tip ? (
          <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/30 px-3 py-2.5">
            <p className="text-[8px] uppercase tracking-[0.28em] text-zinc-600 mb-1.5">{t.tip}</p>
            <p className="text-[12px] text-zinc-300 leading-relaxed">{analysis.styling_tip}</p>
          </div>
        ) : null}

        {finalRating != null ? (
          <div className="pt-3 border-t border-zinc-800/50 flex items-baseline justify-between gap-4">
            <p className="text-[8px] uppercase tracking-[0.28em] text-zinc-600">{t.finalRating}</p>
            <p className="text-lg font-semibold text-white tabular-nums">{finalRating}/10</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
