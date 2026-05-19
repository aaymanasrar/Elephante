import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithFallback, extractJSON } from '@/services/aiProviders'

interface AnalysisPayload {
  outfit_name: string
  style: string
  vibe: string
  color_scheme: string
  occasions: string[]
  pieces: string[]
  color_names: string[]
  key_colors: string[]
  why_it_works: string
  styling_tip: string
  rating_out_of_10: number | null
  match_score: number | null
  proportion_score: number | null
  color_harmony_score: number | null
  silhouette_feedback: string
  skin_tone_feedback: string
  overall_verdict: string
}

interface FollowUpPayload {
  answer: string
  suggested_questions: string[]
}

type AnalysisMode = 'inventory' | 'rating' | 'question'

const VISION_PROMPT = `You are Elephante's AI Stylist, an expert in high-fashion, color theory, and silhouette engineering. Analyse the attached outfit image(s) and return ONLY a raw JSON object (no markdown, no code blocks) with this exact structure:
{
  "outfit_name": "short catchy name for the look",
  "style": "style category e.g. Smart Casual, Business Casual, Formal, Streetwear",
  "vibe": "3 words max",
  "color_scheme": "1 sentence describing the palette",
  "occasions": ["occasion1", "occasion2"],
  "pieces": ["visible top garment description", "visible bottom garment description", "visible shoes description", "visible bag/watch/belt/jewellery/hat/eyewear if present"],
  "color_names": ["ColorName1", "ColorName2", "ColorName3"],
  "key_colors": ["#hex1", "#hex2", "#hex3"],
  "why_it_works": "2 sentences about why this outfit works stylistically",
  "styling_tip": "one actionable tip to elevate the look using specific styling techniques",
  "rating_out_of_10": 8.5,
  "match_score": 85,
  "proportion_score": 90,
  "color_harmony_score": 88,
  "silhouette_feedback": "Detailed feedback on how the fit and volume of the clothes interact with the user's body shape and height",
  "skin_tone_feedback": "Detailed feedback on how these colors complement the user's skin tone and undertone using Seasonal Color Analysis principles",
  "overall_verdict": "A summary verdict on the overall look"
}
For pieces: include every visible outfit item as its own string. Name the category plus visible color/material/cut when possible. Include tops, bottoms, shoes, outerwear, bags, hats, belts, watches, jewellery, eyewear, socks, and visible layering. Do not invent hidden items; omit anything that is not visible instead of adding null.
For color_names: simple English color names like Navy, White, Tan, Charcoal etc.
All percentage scores should be between 0 and 100. rating_out_of_10 should be between 0 and 10 and may use one decimal.

Expert Analysis Criteria:
1. Proportion (Proportion Score): Use the 'Rule of Thirds' and 'Golden Ratio'. Evaluate if the horizontal lines created by the garments (waistline, hemline) divide the body into flattering segments.
2. Color Harmony (Color Harmony Score): Evaluate the palette based on complementary, analogous, or monochromatic color theory.
3. Skin-tone Harmony: Determine if the palette matches the user's seasonal color (Spring, Summer, Autumn, Winter) based on their skin tone and undertone.
4. Silhouette & Fit (Silhouette Feedback): Analyze the volume (tight vs loose) and how it balances the user's body shape (e.g., Hourglass, Rectangle, Inverted Triangle).
5. Overall Cohesion: Formality balance, texture interaction, and intentionality.

Be honest, sophisticated, and specific. If the user's profile data is not provided, provide general expert advice based on the visible image.`

const INVENTORY_PROMPT = `You are Elephante's visual fashion analyst. Identify what is visible in the attached clothing or outfit image and return ONLY a raw JSON object (no markdown, no code blocks) with this exact structure:
{
  "outfit_name": "short descriptive name for what is visible",
  "style": "style category if inferable, otherwise Clothing Analysis",
  "vibe": "3 words max",
  "color_scheme": "1 sentence describing the visible palette",
  "occasions": ["occasion1", "occasion2"],
  "pieces": ["visible top garment description", "visible bottom garment description", "visible shoes description", "visible bag/watch/belt/jewellery/hat/eyewear if present"],
  "color_names": ["ColorName1", "ColorName2", "ColorName3"],
  "key_colors": ["#hex1", "#hex2", "#hex3"],
  "why_it_works": "1 sentence describing the visible styling or item logic without rating it",
  "styling_tip": "one neutral styling possibility based on the visible items",
  "rating_out_of_10": null,
  "match_score": null,
  "proportion_score": null,
  "color_harmony_score": null,
  "silhouette_feedback": "Brief neutral description of the visible silhouette",
  "skin_tone_feedback": "Do not rate skin-tone fit yet. If skin is visible, briefly name that rating can consider contrast later; otherwise say skin tone is not visible.",
  "overall_verdict": "A concise inventory summary of what is visible, not a judgement"
}
For pieces: include every visible outfit item as its own string. Name the category plus visible color/material/cut when possible. Include tops, bottoms, shoes, outerwear, bags, hats, belts, watches, jewellery, eyewear, socks, and visible layering. Do not invent hidden items; omit anything that is not visible instead of adding null.
Do not score or judge the outfit in this mode. Focus on what is there: garments, colors, silhouette, and visible styling details.`

const FOLLOW_UP_PROMPT = `You are Elephante's AI Stylist in an ongoing chat about the attached outfit image(s). Answer the user's follow-up question by looking at the image and using the prior analysis only as supporting context.

Return ONLY a raw JSON object (no markdown, no code blocks) with this exact structure:
{
  "answer": "direct conversational answer to the user's question, 2-5 sentences, specific to the visible outfit",
  "suggested_questions": ["short useful follow-up question", "short useful follow-up question", "short useful follow-up question"]
}

Rules:
- Stay grounded in what is visible. Do not invent hidden items, brands, body details, or materials you cannot see.
- If the user asks for a rating, include a clear score and one reason.
- If the user asks how to improve the look, give concrete changes by garment, color, fit, or accessory.
- If the question is ambiguous, answer the most likely fashion interpretation and offer one focused next question.
- Keep the tone warm, concise, and stylist-like.`

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim())))
}

function getImageUrls(body: Record<string, unknown>) {
  const imageUrls = Array.isArray(body.image_urls) ? body.image_urls : []
  return uniqueStrings([
    body.image_url,
    body.secondary_image_url,
    ...imageUrls,
  ])
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

function parseNumeric(value: unknown) {
  const score = typeof value === 'string'
    ? Number(value.match(/-?\d+(?:\.\d+)?/)?.[0])
    : Number(value)
  return Number.isFinite(score) ? score : null
}

function clampScore(value: unknown) {
  const score = parseNumeric(value)
  if (score === null) return 70
  return Math.max(0, Math.min(100, Math.round(score)))
}

function clampOutOf10(value: unknown, fallbackScores: Array<number | null>) {
  const direct = parseNumeric(value)
  if (direct !== null) {
    const normalized = direct > 10 ? direct / 10 : direct
    return Math.max(0, Math.min(10, Math.round(normalized * 10) / 10))
  }

  const usableScores = fallbackScores.filter((score): score is number => Number.isFinite(score))
  const fallback = usableScores.length
    ? usableScores.reduce((sum, score) => sum + score, 0) / usableScores.length / 10
    : 7
  return Math.max(0, Math.min(10, Math.round(fallback * 10) / 10))
}

function normalizePieces(value: unknown, fallback: string[]) {
  const pieces = asStringArray(value, fallback)
  const cleaned = uniqueStrings(pieces).filter((piece) => {
    const normalized = piece.toLowerCase()
    return !['null', 'none', 'n/a', 'na'].includes(normalized) && !normalized.includes('not visible') && !normalized.includes('not shown')
  })
  return cleaned.length ? cleaned : fallback
}

function compactModelText(raw: string) {
  return raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim()
    .slice(0, 600)
}

function stringifyForPrompt(value: unknown, maxChars = 2200) {
  if (!value) return ''
  try {
    const text = JSON.stringify(value, null, 2)
    return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text
  } catch {
    return ''
  }
}

function normalizeFollowUp(parsed: Record<string, unknown>, fallbackText: string, language: string): FollowUpPayload {
  const fallback = compactModelText(fallbackText)
  const answer = asString(
    parsed.answer,
    fallback || (language === 'ar'
      ? 'أستطيع مساعدتك في هذه الصورة. اسألني عن التناسق، الألوان، المقاس، أو كيف نطوّر الإطلالة.'
      : 'I can help with this photo. Ask me about the outfit balance, colors, fit, or how to improve the look.'),
  )

  return {
    answer,
    suggested_questions: asStringArray(parsed.suggested_questions).slice(0, 3),
  }
}

function normalizeAnalysis(parsed: Record<string, unknown>, fallbackText: string, skinTone: string, mode: AnalysisMode): AnalysisPayload {
  const overallFallback = compactModelText(fallbackText) || 'The outfit has been reviewed for color harmony, proportion, and overall cohesion.'
  const limitedSkinTone = skinTone
    ? `For ${skinTone.replace(/_/g, ' ')}, the palette should be judged by contrast, warmth, and whether the colors brighten the complexion.`
    : 'Skin-tone feedback is limited because no skin tone was provided.'
  const normalizedPieces = normalizePieces(parsed.pieces, ['visible outfit item'])
  const matchScore = mode === 'rating' ? clampScore(parsed.match_score) : null
  const proportionScore = mode === 'rating' ? clampScore(parsed.proportion_score) : null
  const colorHarmonyScore = mode === 'rating' ? clampScore(parsed.color_harmony_score) : null

  return {
    outfit_name: asString(parsed.outfit_name, 'Attached Outfit'),
    style: asString(parsed.style, 'Personal Style'),
    vibe: asString(parsed.vibe, 'Considered look'),
    color_scheme: asString(parsed.color_scheme, 'Palette identified from the attached outfit photo.'),
    occasions: asStringArray(parsed.occasions, ['Everyday']),
    pieces: normalizedPieces,
    color_names: asStringArray(parsed.color_names),
    key_colors: asStringArray(parsed.key_colors).filter((hex) => /^#[0-9a-f]{6}$/i.test(hex)).slice(0, 6),
    why_it_works: asString(parsed.why_it_works, overallFallback),
    styling_tip: asString(parsed.styling_tip, 'If something feels off, repeat one key color in the shoes, bag, or outerwear to make the outfit feel intentional.'),
    rating_out_of_10: mode === 'rating' ? clampOutOf10(parsed.rating_out_of_10, [matchScore, proportionScore, colorHarmonyScore]) : null,
    match_score: matchScore,
    proportion_score: proportionScore,
    color_harmony_score: colorHarmonyScore,
    silhouette_feedback: asString(parsed.silhouette_feedback, 'Silhouette analysis considers volume and proportion relative to your body shape.'),
    skin_tone_feedback: asString(parsed.skin_tone_feedback, limitedSkinTone),
    overall_verdict: asString(parsed.overall_verdict, overallFallback),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const imageUrls = getImageUrls(body)
    const outfitDetails = asString(body.outfit_details)
    const skinTone = asString(body.skin_tone)
    const imageLabels = asStringArray(body.image_labels)
    const language = asString(body.language, 'en')
    const requestedMode = asString(body.mode)
    const mode: AnalysisMode = requestedMode === 'inventory' || requestedMode === 'question' ? requestedMode : 'rating'
    const question = asString(body.question || body.user_request || body.query)
    const gender = asString(body.gender)
    const skinUndertone = asString(body.skin_undertone)
    const bodyShape = asString(body.body_shape)
    const heightCategory = asString(body.height_category)

    if (imageUrls.length === 0) return NextResponse.json({ error: 'At least one outfit image is required.' }, { status: 400 })
    if (mode === 'question' && !question) return NextResponse.json({ error: 'A follow-up question is required.' }, { status: 400 })

    let prompt = mode === 'inventory' ? INVENTORY_PROMPT : mode === 'question' ? FOLLOW_UP_PROMPT : VISION_PROMPT
    
    // Build User Context String
    let contextStr = ''
    if (gender) contextStr += `\n- Gender: ${gender}`
    if (skinTone) contextStr += `\n- Skin Tone: ${skinTone.replace(/_/g, ' ')}`
    if (skinUndertone) contextStr += `\n- Skin Undertone: ${skinUndertone}`
    if (bodyShape) contextStr += `\n- Body Shape: ${bodyShape.replace(/_/g, ' ')}`
    if (heightCategory) contextStr += `\n- Height Category: ${heightCategory.replace(/_/g, ' ')}`

    if (contextStr) {
      prompt += `\n\nUser Profile Context:${contextStr}\nUse this data to provide highly personalized advice.`
    } else {
      prompt += '\n\nNo user profile data provided. Provide general expert advice.'
    }
    if (language === 'ar') {
      prompt += '\n\nWrite every user-facing JSON string value in Arabic.'
    }
    if (outfitDetails) {
      prompt += `\n\nKnown outfit details from the user interface:\n${outfitDetails}`
    }
    if (mode === 'question') {
      const priorAnalysis = stringifyForPrompt(body.prior_analysis)
      const priorTurns = Array.isArray(body.prior_turns)
        ? body.prior_turns
          .slice(-8)
          .map((turn) => {
            if (!turn || typeof turn !== 'object') return ''
            const role = asString((turn as Record<string, unknown>).role, 'user')
            const content = asString((turn as Record<string, unknown>).content)
            return content ? `${role}: ${content}` : ''
          })
          .filter(Boolean)
          .join('\n')
        : ''

      if (priorAnalysis) prompt += `\n\nPrior structured analysis:\n${priorAnalysis}`
      if (priorTurns) prompt += `\n\nRecent chat turns:\n${priorTurns}`
      prompt += `\n\nUser follow-up question:\n${question}`
    }
    if (imageUrls.length > 1) {
      const labels = imageUrls.map((_, index) => imageLabels[index] || `image ${index + 1}`).join(', ')
      prompt += `\n\nMultiple outfit images are provided in this order: ${labels}. Consider them together as one outfit.`
    }

    const { content } = await analyzeImageWithFallback(imageUrls, prompt)
    const parsed = extractJSON(content) as Record<string, unknown>
    if (mode === 'question') {
      const followUp = normalizeFollowUp(parsed, content, language)
      return NextResponse.json({ ...followUp, mode })
    }

    const analysis = normalizeAnalysis(parsed, content, skinTone, mode)

    return NextResponse.json({ analysis, mode })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[analyze-outfit-image]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
