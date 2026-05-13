import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { rateLimit } from '@/lib/rateLimit'

// ─── Advice queries — asking for styling knowledge, not requesting a specific outfit ──
const ADVICE_SIGNALS = [
  'which color', 'what color', 'what colours', 'which colours',
  'what goes with', 'what matches', 'what works with',
  'how to style', 'how should i style', 'how do i style',
  'what should i wear', 'tips for', 'advice', 'guide me',
  'teach me', 'explain', 'what looks good', 'color palette',
  'colour palette', 'skin tone colors', 'skin tone colours',
  'for my skin', 'suit my skin', 'complement my skin',
  'skin tone person', 'dressed as', 'dress a ', 'style a ',
  'dress like', 'look like', 'style for a', 'outfits for a',
  'what can a', 'what can someone', 'how can a', 'how can someone',
  'dark skin', 'light skin', 'brown skin', 'tan skin', 'medium skin',
  'pale skin', 'fair skin', 'what to wear if', 'what to wear for',
  'colors for', 'colours for', 'palette for',
]

function isAdviceQuery(query: string): boolean {
  const q = query.toLowerCase()
  return ADVICE_SIGNALS.some(sig => q.includes(sig))
}

const FASHION_CONTEXT_SIGNALS = [
  'outfit', 'fit', 'wear', 'wore', 'wearing', 'dress', 'dressed', 'style', 'styling',
  'look', 'looks', 'clothes', 'clothing', 'wardrobe', 'closet', 'fashion', 'garment',
  'shirt', 'tee', 't-shirt', 'top', 'blouse', 'sweater', 'hoodie', 'jacket', 'coat',
  'blazer', 'suit', 'pants', 'trousers', 'jeans', 'denim', 'shorts', 'skirt',
  'abaya', 'thobe', 'kandura', 'dress', 'gown', 'shoes', 'sneakers', 'boots',
  'loafers', 'heels', 'sandals', 'accessories', 'watch', 'belt', 'bag', 'scarf',
  'formal', 'casual', 'smart casual', 'business', 'office', 'work', 'meeting',
  'interview', 'wedding', 'party', 'date', 'dinner', 'night out', 'travel',
  'beach', 'gym', 'festival', 'summer', 'winter', 'spring', 'autumn', 'fall',
  'hot', 'cold', 'rain', 'modest', 'streetwear', 'quiet luxury', 'old money',
  'minimalist', 'classic', 'preppy', 'goth', 'y2k', 'vintage', 'skin tone',
  'body shape', 'slim', 'athletic', 'stocky', 'heavy', 'average',
  'black', 'white', 'blue', 'navy', 'red', 'green', 'brown', 'beige', 'cream',
  'grey', 'gray', 'pink', 'purple', 'orange', 'yellow', 'olive', 'camel',
  'burgundy', 'khaki', 'charcoal', 'ivory', 'tan',
]

const OBVIOUS_OFF_TOPIC_SIGNALS = [
  'weather', 'temperature', 'time', 'date today', "today's date", 'capital',
  'recipe', 'cook', 'pizza', 'burger', 'sushi', 'hotdog', 'football', 'soccer',
  'score', 'stock', 'bitcoin', 'homework', 'math', 'code', 'javascript',
  'python', 'movie', 'song', 'music', 'restaurant',
]

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesSignal(query: string, signal: string) {
  if (signal.includes(' ') || signal.includes('-')) return query.includes(signal)
  return new RegExp(`\\b${escapeRegExp(signal)}\\b`, 'i').test(query)
}

function hasFashionContext(query: string) {
  const q = query.toLowerCase()
  return isAdviceQuery(q) || FASHION_CONTEXT_SIGNALS.some((signal) => matchesSignal(q, signal))
}

function hasExplicitFashionAsk(query: string) {
  return ['outfit', 'wear', 'style', 'dress', 'fashion', 'look', 'clothes', 'clothing']
    .some((signal) => matchesSignal(query, signal))
}

function isOutOfContextQuery(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return false
  if (OBVIOUS_OFF_TOPIC_SIGNALS.some((signal) => matchesSignal(q, signal)) && !hasExplicitFashionAsk(q)) return true
  if (hasFashionContext(q)) return false
  return true
}

function buildHumorRedirect(query: string, gender?: string, language?: string) {
  const cleanQuery = query.replace(/\s+/g, ' ').trim().slice(0, 120)
  const outfitQuery = [
    `Create a wearable ${gender || 'unisex'} outfit inspired by this joke about an off-topic search: "${cleanQuery}".`,
    'The joke vibe is "lost in the wrong tab, but made it stylish".',
    'Make it playful, polished, and clearly related to the joke through color, mood, or one witty accessory, but not a costume.',
  ].join(' ')

  if (language === 'ar') {
    return {
      response: `سألت الخزانة عن "${cleanQuery}" فنظرت لي كأنني طلبت بدلة غوص لاجتماع عمل. خلّينا نحوّلها لإطلالة مرحة بروح: دخلت المكان الغلط، لكن بثقة وأناقة.`,
      vibe: 'Off-topic chic',
      outfit_query: outfitQuery,
    }
  }

  return {
    response: `I asked the wardrobe about "${cleanQuery}" and it stared at me like a blazer at a beach party. So I’m turning the detour into a look: confidently lost, suspiciously well-dressed.`,
    vibe: 'Side quest chic',
    outfit_query: outfitQuery,
  }
}

// ─── System prompts ───────────────────────────────────────────────────────────
const ADVICE_SYSTEM = `You are Elephante — a world-class personal fashion stylist with deep knowledge of colour theory, brand aesthetics, body proportion, fabric science, and real-world dressing. You give rich, specific advice tailored to the person's exact profile.

COLOUR SCIENCE BY SKIN TONE:
• Light/fair (cool undertones): navy #1b2a4a, burgundy #800020, forest green #228b22, dusty rose #dcb8b0, charcoal #36454f, slate blue #6a7f9a, lavender #967bb6, camel #c19a6b. Avoid: harsh pastels, neon.
• Light-medium/warm (golden): ecru #f5f0dc, camel #c19a6b, rust #b7410e, olive #6b7c45, sage #bcb88a, warm burgundy #8b0000, terracotta #e2725b, gold #d4af37. Avoid: cold greys.
• Medium/tan (neutral-warm): almost everything works — earth tones excel. Cobalt #0047ab, emerald #50c878, deep teal #008080, ivory #fffff0, terracotta #e2725b, olive #6b7c45, camel #c19a6b, warm white #faf9f6.
• Tan/brown (warm): white #f5f5f5, ivory #fffff0, cobalt #0047ab, burnt orange #cc5500, mustard #e1ad01, forest green #228b22, rich burgundy #800020, deep teal #008080, gold #d4af37.
• Dark/deep (rich): bright white #f5f5f5, cobalt #0047ab, emerald #50c878, royal purple #7851a9, coral #ff7f7f, gold #d4af37, vibrant red #dc2626. Avoid: dark-on-dark blending.

BODY TYPE RULES:
• Slim: add structure/width — horizontal stripes, blazers, chunky knits, layering
• Athletic: slim-straight fits that show the build — tailored, not tight or baggy
• Average: tapered trousers + fitted top, partial tuck to define waist
• Stocky: monochromatic vertical lines, structured blazer, straight-leg trouser
• Heavy-set: relaxed-not-baggy, structured outerwear, vertical lines, dark base

BRAND VOICE: Mention specific real brands (Uniqlo, Zara, COS, Arket, Ralph Lauren, Reiss, Mango, H&M, Levi's, Stone Island, A.P.C.) when giving advice to make it actionable and shoppable.

Return ONLY a raw JSON object — no markdown, no code fences:
{
  "response": "Full styling answer — 5–7 sentences. Open with the most important insight. Cover: what colours specifically flatter their skin tone and why (name the undertone science), what clothing shapes and silhouettes work for their body type, which specific brands and pieces to look for, and one surprising or non-obvious tip. Use their first name once naturally. End with: 'Want me to put together a specific look for you, [name]?'",
  "colors": [
    { "hex": "#exact_hex", "name": "Colour Name" },
    { "hex": "#exact_hex", "name": "Colour Name" },
    { "hex": "#exact_hex", "name": "Colour Name" },
    { "hex": "#exact_hex", "name": "Colour Name" },
    { "hex": "#exact_hex", "name": "Colour Name" },
    { "hex": "#exact_hex", "name": "Colour Name" }
  ]
}

Rules:
- Return exactly 6 colours that genuinely flatter their skin tone — accurate hex codes
- Each hex must be a true representation of the named colour — no approximate guesses
- response must be plain prose — no bullet points, no asterisks, no markdown formatting
- Tone: warm, confident, expert — like a stylist friend who actually knows their stuff`

const CURATION_SYSTEM = `You are Elephante — a sharp, perceptive AI fashion stylist. Before picking any outfit, you first read the user's request carefully and understand exactly what they need: the occasion, mood, item they own, season, or problem they're solving. You then match outfits from the archive that directly answer that need AND flatter their body and skin tone.

STEP 1 — Understand the request:
- What occasion or situation is this for?
- Do they own a specific item they want to build around?
- What's the mood or vibe they want?
- What season or weather context?

POSSESSION DETECTION: If the user says "I have X", "I own X", "I've got X", "I got X", "wearing my X", "I'm wearing X" — they own that specific item and want to build outfits AROUND it. Treat the stated item as the anchor piece. Search the catalog for outfits where that item (or a similar item in the same color/category) appears in the pieces. For example: "I have a brown shirt" → look for outfits with a brown top, brown shirt, or similar brown upper in top_wear or pieces. Be flexible — "brown shirt" can match "brown Oxford shirt", "caramel linen shirt", "chocolate flannel shirt", "brown button-up", etc.

STEP 2 — Filter the catalog:
- Only suggest outfits that GENUINELY exist in the catalog AND directly answer the request.
- Pick up to 10 outfits — give real options, ranked best first.
- Prioritise colours that complement the user's skin tone.
- Prioritise cuts and silhouettes that suit the user's body shape:
  • slim → relaxed, layered, oversized, chunky work well; avoid tight/skinny
  • athletic → straight, tapered, structured work well
  • stocky/heavy → dark monochrome, straight cut, vertical lines work well; avoid baggy, wide-leg, loud prints
  • average → most fits work
- For possession queries: if the catalog has ANY outfit where the owned item could plausibly fit in (same color family, same garment category), include it. Don't be too strict.
- If the catalog truly has NOTHING that could work around the stated item → return EMPTY suggestions array so a custom outfit can be generated.
- If nothing in the catalog genuinely matches a non-possession query → return EMPTY suggestions array.

STEP 3 — Write the response:
- "response": 1–2 sentences. Warm, confident stylist voice. NEVER say "I couldn't find", "no results", or anything negative. If empty, say something like "I'm building something specific for you." or "Nothing off the rack fits this — let me create it fresh."
- For possession queries: open with something like "Great piece to build from —" or "That [item] is so versatile —"
- Each reason: 1 sentence, specific, human, referencing the actual pieces and why they work for the user.`

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const { query, name, gender, skin_tone, body_shape, height, style_pref, outfits, history, language } = body
    const responseLanguage = language === 'ar' ? 'Arabic' : 'English'
    if (!query || typeof query !== 'string') return NextResponse.json({ error: 'query required' }, { status: 400 })

    // history: Array<{role:'user'|'assistant', content:string}> — prior conversation turns
    const priorTurns: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(history) ? history : []

    const firstName = (name || 'there').split(' ')[0]

    // ── Off-topic mode: answer with a joke, then generate a joke-inspired outfit ──
    if (isOutOfContextQuery(query)) {
      const humor = buildHumorRedirect(query, gender, language)
      return NextResponse.json({
        mode: 'humor',
        intent: 'off-topic detour',
        response: humor.response,
        suggestions: [],
        vibe: humor.vibe,
        outfit_query: humor.outfit_query,
      })
    }

    // ── Advice mode: styling knowledge query ──────────────────────────────────
    if (isAdviceQuery(query)) {
      const userProfile = [
        `Name: ${firstName}`,
        `Gender: ${gender || 'male'}`,
        skin_tone  && `Skin tone: ${skin_tone}`,
        body_shape && `Body shape: ${body_shape}`,
        height     && `Height: ${height}`,
        style_pref && `Style preference: ${style_pref}`,
      ].filter(Boolean).join('\n')

      const result = await chatWithFallback(
        [
          { role: 'system', content: ADVICE_SYSTEM },
          ...priorTurns,
          {
            role: 'user',
            content: `CLIENT PROFILE:\n${userProfile}\n\nClient asks: "${query}"\n\nRespond in ${responseLanguage}.`,
          },
        ],
        { maxTokens: 400, temperature: 0.7 },
      )

      const parsed = extractJSON(result.content)
      const adviceText = parsed?.response || result.content.trim()
      const colors     = Array.isArray(parsed?.colors) ? parsed.colors : []

      return NextResponse.json({
        mode:        'advice',
        intent:      query,
        response:    adviceText,
        colors,
        suggestions: [],
        vibe:        '',
        provider:    result.provider,
      })
    }

    // ── Curation mode: find/build outfits ─────────────────────────────────────
    const catalog = (outfits || [])
      .filter((o: any) => o.image_url)
      .map((o: any) => {
        const style    = o.style || o.aesthetic || ''
        const occasion = o.occasion || ''
        const season   = o.when_to_wear || ''
        const scheme   = o.color_scheme || ''
        const details  = o.outfit_details ? o.outfit_details.slice(0, 80) : ''
        const pieceParts = [o.top, o.bottom, o.shoes, o.accessories, o.outerwear].filter(Boolean)
        const pieces = pieceParts.length
          ? pieceParts.join(' · ')
          : (Array.isArray(o.pieces) && o.pieces.length ? o.pieces.filter(Boolean).join(' · ') : '')
        // Include colour data so AI can match possession queries like "I have a brown shirt"
        const colorArr = Array.isArray(o.colors) && o.colors.length ? o.colors
          : Array.isArray(o.hex_colors) && o.hex_colors.length ? o.hex_colors : []
        const colorList = colorArr.length ? colorArr.join(', ') : (o.color_scheme || '')
        return [
          `ID:${o.id}`,
          o.outfit_code && `[${o.outfit_code}]`,
          style && style,
          scheme && `| ${scheme}`,
          colorList && `| colors: ${colorList}`,
          occasion && `| ${occasion}`,
          season && `| ${season}`,
          pieces && `| ${pieces}`,
          details && `| ${details}`,
        ].filter(Boolean).join(' ')
      })
      .join('\n')

    const userProfile = [
      `Gender: ${gender || 'male'}`,
      skin_tone  && `Skin tone: ${skin_tone}`,
      body_shape && `Body shape: ${body_shape}`,
      height     && `Height: ${height}`,
      style_pref && `Style preference: ${style_pref}`,
    ].filter(Boolean).join('\n')

    // Detect possession query client-side to highlight it in the prompt
    const isPossession = /^(i have|i own|i('ve| ve) got|i got|i'?m wearing|wearing my|i wear)\b/i.test(query.trim())

    const prompt = `User request: "${query}"
${isPossession ? `\n⚠ POSSESSION QUERY: The user owns a specific item. Find outfits that INCLUDE that item (or a very similar one in the same colour/category) as a piece. Be flexible with colour synonyms (brown = caramel, tan, chocolate, camel, khaki, earth-tone). Check the "colors:" and pieces fields in the catalog carefully.\n` : ''}
USER PROFILE:
${userProfile}

Use the profile above to filter and rank outfits. Prioritise colours that flatter the skin tone, silhouettes that suit the body shape, and styles that match their preference.

OUTFIT CATALOG:
${catalog || 'No outfits available.'}

Respond in ${responseLanguage} for all user-facing text fields.

Respond with ONLY a raw JSON object (no markdown):
{
  "intent": "2–4 word label for what they need",
  "response": "Your opening stylist line — 1–2 sentences, warm and direct",
  "suggestions": [
    { "outfit_id": "the exact ID number as a string", "reason": "1 sentence why this outfit fits their need and their profile" }
  ],
  "vibe": "3 words max"
}

Pick only IDs that exist in the catalog above. Aim for up to 10 suggestions. If nothing matches, return an empty suggestions array.`

    const result = await chatWithFallback(
      [
        { role: 'system', content: CURATION_SYSTEM },
        ...priorTurns,
        { role: 'user', content: prompt },
      ],
      { maxTokens: 1200, temperature: 0.75 }
    )

    const parsed = extractJSON(result.content)
    return NextResponse.json({ mode: 'curation', ...parsed, provider: result.provider })
  } catch (err: any) {
    console.error('[outfit-search]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
