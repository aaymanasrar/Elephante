import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { rateLimit } from '@/lib/rateLimit'

export const maxDuration = 120

const SYSTEM = `You are Elephante, a travel wardrobe expert. Create a smart, capsule packing list for a trip. Focus on versatile pieces that can be mixed and matched. Tailor to the user's gender, body shape, and style. Keep it practical — no overpacking.

Return ONLY raw JSON (no markdown, no code fences):
{
  "destination_summary": "one sentence about the fashion culture/dress code of this destination",
  "outfits": [
    { "day": "Day 1", "outfit": "full outfit description", "occasion": "occasion name" }
  ],
  "essentials": ["item1", "item2"],
  "shoes": ["shoe1", "shoe2"],
  "accessories": ["item1", "item2"],
  "pro_tip": "one travel styling tip"
}`

function buildFallbackPackingList(destination: string, climate: string, gender: string, occasions: string) {
  const dest = destination.toLowerCase()
  const isHot = /hot|tropical|humid|beach|dubai|india|thailand|singapore|bali/.test(dest + climate.toLowerCase())
  const isCold = /cold|snow|winter|norway|iceland|canada|alaska/.test(dest + climate.toLowerCase())
  const isIndia = /india|mumbai|delhi|chennai|bangalore|kolkata|jaipur|hyderabad/.test(dest)
  const isGulf = /dubai|abu dhabi|riyadh|doha|kuwait|bahrain|muscat|uae|saudi/.test(dest)
  const isFormal = /business|formal/.test(occasions.toLowerCase())

  const isF = /female|woman|women|girl/.test(gender.toLowerCase())

  if (isIndia && isF) {
    return {
      destination_summary: `${destination} blends rich tradition with modern fashion. Lightweight cotton salwars and sarees work beautifully; modest coverage is appreciated in cultural sites.`,
      outfits: [
        { day: 'Day 1', outfit: 'Printed cotton salwar kameez with dupatta in soft pastels', occasion: 'Arrival / Exploring' },
        { day: 'Day 2', outfit: 'Flowy anarkali kurta with palazzo pants and kolhapuri flats', occasion: 'Sightseeing' },
        { day: 'Day 3', outfit: 'Silk or georgette saree with matching blouse', occasion: 'Cultural / Celebration' },
      ],
      essentials: ['Breathable cotton dupattas', 'Sun protection (scarf / hat)', 'Comfortable flats', 'Modest wrap for temple visits'],
      shoes: ['Kolhapuri flats', 'Block heels for evenings', 'Comfortable sandals'],
      accessories: ['Jhumka earrings', 'Bangle set', 'Potli bag'],
      pro_tip: 'Pack a lightweight dupatta — it doubles as a modesty scarf at temples and a sun shield outdoors.',
    }
  }

  if (isIndia && !isF) {
    return {
      destination_summary: `${destination} is vibrant and colour-rich. Lightweight kurtas or linen trousers are ideal; smart-casual works for most settings.`,
      outfits: [
        { day: 'Day 1', outfit: 'Linen kurta with slim trousers and leather mojaris', occasion: 'Arrival / Exploring' },
        { day: 'Day 2', outfit: 'Cotton shirt with chinos and loafers', occasion: 'City touring' },
        { day: 'Day 3', outfit: 'Sherwani kurta with churidar for evening events', occasion: 'Dinner / Celebration' },
      ],
      essentials: ['Breathable linen shirts', 'A neutral kurta', 'Light cotton trousers', 'Sun protection'],
      shoes: ['Mojari / jutti', 'Loafers', 'Comfortable sandals'],
      accessories: ['Statement watch', 'Pocket square', 'Leather card holder'],
      pro_tip: 'A simple cotton kurta gets you into temples and fancy restaurants alike — it\'s the most versatile piece you can pack.',
    }
  }

  if (isGulf) {
    return {
      destination_summary: `${destination} is a cosmopolitan destination where modest, elegant dressing is respected. Smart-casual and formal both work well; cover shoulders and knees in public areas.`,
      outfits: [
        { day: 'Day 1', outfit: isF ? 'Flowy maxi dress with light blazer' : 'Linen trousers with button-down shirt', occasion: 'Arrival' },
        { day: 'Day 2', outfit: isF ? 'Tailored wide-leg trousers with silk blouse' : 'Chinos with polo shirt', occasion: isFormal ? 'Business meeting' : 'City exploration' },
        { day: 'Day 3', outfit: isF ? 'Evening jumpsuit with statement accessories' : 'Smart blazer with dress shirt', occasion: 'Dinner' },
      ],
      essentials: ['Light cardigan or blazer for air-conditioned spaces', 'Sun protection', 'Modest coverage layers'],
      shoes: isF ? ['Block-heeled sandals', 'Loafers', 'Strappy evening heels'] : ['Leather loafers', 'Clean white sneakers', 'Dress shoes'],
      accessories: isF ? ['Gold jewellery', 'Structured handbag', 'Silk scarf'] : ['Classic watch', 'Leather belt', 'Sunglasses'],
      pro_tip: 'Always carry a light layer — interiors are heavily air-conditioned and the contrast with outdoor heat is sharp.',
    }
  }

  const hotEssentials = ['Breathable cotton tees', 'Light linen trousers or shorts', 'Sun hat', 'SPF-rated clothing']
  const coldEssentials = ['Thermal base layer', 'Insulated mid-layer', 'Waterproof outer layer', 'Warm socks and gloves']

  return {
    destination_summary: `${destination} offers a mix of casual and smart-casual dressing. ${isHot ? 'Light, breathable fabrics are essential given the warm weather.' : isCold ? 'Layer up — temperatures can drop sharply.' : 'Comfortable smart-casual works for most occasions.'}`,
    outfits: [
      { day: 'Day 1', outfit: isF ? (isHot ? 'Linen co-ord set in neutral tones with sandals' : 'Tailored trousers with oversized knit and ankle boots') : (isHot ? 'Linen shirt with chinos and canvas shoes' : 'Dark jeans with layer-friendly button-down and boots'), occasion: 'Arrival / Exploring' },
      { day: 'Day 2', outfit: isF ? (isFormal ? 'Midi blazer dress with kitten heels' : 'Sundress with white sneakers') : (isFormal ? 'Slim trousers with blazer and loafers' : 'Chinos with polo and clean sneakers'), occasion: isFormal ? 'Business' : 'Sightseeing' },
      { day: 'Day 3', outfit: isF ? 'Evening wrap dress with strappy heels and clutch' : 'Slim dark trousers with open-collar dress shirt', occasion: 'Dinner / Evening out' },
    ],
    essentials: isHot ? hotEssentials : isCold ? coldEssentials : ['Versatile neutral basics', 'One smart layer', 'Comfortable walking shoes', 'Compact umbrella'],
    shoes: isF ? (isHot ? ['Flat sandals', 'White sneakers', 'Block-heel mules'] : ['Ankle boots', 'Loafers', 'Knee-high boots']) : (isHot ? ['Canvas sneakers', 'Leather sandals', 'Driving loafers'] : ['Chelsea boots', 'White sneakers', 'Derby shoes']),
    accessories: isF ? ['Sunglasses', 'Tote bag', 'Silk scarf'] : ['Sunglasses', 'Minimal watch', 'Crossbody bag'],
    pro_tip: 'Build your packing list around 3 neutral base pieces that mix and match — you\'ll halve your luggage and still have an outfit for every occasion.',
  }
}

export async function POST(req: NextRequest) {
  const { ok, retryAfter } = rateLimit(req, { limit: 5, window: 60 })
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const { destination, duration, occasions, climate, profile } = await req.json()

    if (!destination?.trim()) {
      return NextResponse.json({ error: 'Destination is required.' }, { status: 400 })
    }

    const gender = profile?.gender || 'unspecified'
    const skin_tone = profile?.skin_tone || 'medium'
    const body_shape = profile?.body_shape || 'average'
    const style_pref = profile?.style_pref || profile?.style || 'versatile'

    const occasionList = Array.isArray(occasions) && occasions.length > 0
      ? occasions.join(', ')
      : 'General travel'

    const userMessage = `Trip to ${destination} for ${duration}. Occasions: ${occasionList}. Climate: ${climate}. User: ${gender}, ${skin_tone} skin, ${body_shape} build, ${style_pref} style.`

    const result = await chatWithFallback(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userMessage },
      ],
      { maxTokens: 1500, temperature: 0.7 }
    )

    const parsed = extractJSON(result.content)

    if (!parsed || (!parsed.outfits && !parsed.essentials)) {
      const fallback = buildFallbackPackingList(destination, climate, gender, occasionList)
      return NextResponse.json({ packingList: fallback, provider: 'fallback' })
    }

    return NextResponse.json({ packingList: parsed, provider: result.provider })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[travel-pack]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
