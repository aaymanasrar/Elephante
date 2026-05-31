import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, extractJSON } from '@/services/aiProviders'
import { buildLocalAdviceResponse } from '@/lib/stylistFallback'
import { rateLimit } from '@/lib/rateLimit'

// ─── Advice queries ───────────────────────────────────────────────────────────
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
  'outfit', 'outfits', 'fit', 'fits', 'wear', 'wore', 'wearing', 'dress', 'dressed', 'style', 'styling',
  'look', 'looks', 'clothes', 'clothing', 'wardrobe', 'closet', 'fashion', 'garment', 'garments',
  'shirt', 'tee', 't-shirt', 'top', 'blouse', 'sweater', 'hoodie', 'jacket', 'coat',
  'blazer', 'suit', 'pants', 'trousers', 'jeans', 'denim', 'shorts', 'skirt',
  'abaya', 'thobe', 'kandura', 'kurta', 'saree', 'sherwani', 'salwar', 'kimono', 'hanbok',
  'agbada', 'dashiki', 'ankara', 'kente', 'batik', 'kebaya', 'barong',
  'gown', 'shoes', 'sneakers', 'boots', 'loafers', 'heels', 'sandals', 'mojaris', 'juttis',
  'accessories', 'watch', 'belt', 'bag', 'scarf', 'dupatta', 'turban',
  'formal', 'casual', 'smart casual', 'business', 'office', 'work', 'meeting',
  'interview', 'wedding', 'party', 'date', 'dinner', 'night out', 'travel',
  'beach', 'gym', 'festival', 'summer', 'winter', 'spring', 'autumn', 'fall',
  'hot', 'cold', 'rain', 'modest', 'streetwear', 'quiet luxury', 'old money',
  'minimalist', 'classic', 'preppy', 'goth', 'y2k', 'vintage', 'skin tone',
  'body shape', 'slim', 'athletic', 'stocky', 'heavy', 'average',
  'black', 'white', 'blue', 'navy', 'red', 'green', 'brown', 'beige', 'cream',
  'grey', 'gray', 'pink', 'purple', 'orange', 'yellow', 'olive', 'camel',
  'burgundy', 'khaki', 'charcoal', 'ivory', 'tan',
  'india', 'indian', 'pakistan', 'arabic', 'gulf', 'saudi', 'dubai', 'japanese',
  'korean', 'african', 'nigerian', 'chinese', 'turkish', 'traditional', 'cultural',
  'ethnic', 'heritage', 'eid', 'ramadan', 'diwali', 'holi', 'navratri', 'puja',
  'majlis', 'national day', 'sangeet', 'mehndi', 'reception',
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
  return ['outfit', 'outfits', 'wear', 'style', 'dress', 'fashion', 'look', 'looks', 'clothes', 'clothing']
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
    response: `I asked the wardrobe about "${cleanQuery}" and it stared at me like a blazer at a beach party. So I'm turning the detour into a look: confidently lost, suspiciously well-dressed.`,
    vibe: 'Side quest chic',
    outfit_query: outfitQuery,
  }
}

type WeatherPayload = {
  city?: unknown
  temperature_c?: unknown
  condition?: unknown
}

function buildWeatherSummary(weather: WeatherPayload | null | undefined, language?: string) {
  const city = typeof weather?.city === 'string' ? weather.city.trim() : ''
  const condition = typeof weather?.condition === 'string' ? weather.condition.trim() : ''
  const temperature = Number(weather?.temperature_c)
  if (!city || !condition || !Number.isFinite(temperature)) return ''

  const roundedTemp = Math.round(temperature)
  if (language === 'ar') return `طقس اليوم في ${city}: ${roundedTemp}°C و${condition}`
  return `today's weather in ${city}: ${roundedTemp}°C and ${condition}`
}

function withWeatherOpening(response: string | undefined, weather: WeatherPayload | null | undefined, language?: string) {
  return (response || '').trim()
}

// ─── Advice system ────────────────────────────────────────────────────────────
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

// ─── World Fashion Cards system ───────────────────────────────────────────────
const CARDS_SYSTEM = `You are Elephante — a world-class AI personal stylist with encyclopaedic knowledge of every global fashion tradition, from Western minimalism to Indian heritage textiles, Korean streetwear to Gulf formal attire, Japanese avant-garde to West African wax prints. You curate specific, wearable outfit recommendations tailored to the user's occasion, cultural context, location, and personal profile.

════════════════════════════════════════
LOCATION & CULTURAL DETECTION
════════════════════════════════════════
Detect cultural context from BOTH:
1. Weather city (Mumbai/Delhi/Chennai → South Asian; Tokyo/Osaka → Japanese; Riyadh/Dubai/Doha/Abu Dhabi/Kuwait/Muscat → Gulf Arab; Lagos/Accra/Nairobi → African; Seoul/Busan → Korean; Istanbul → Turkish/Mediterranean; Beijing/Shanghai → Chinese)
2. Query keywords (e.g. "Indian wedding", "traditional Arabic", "Korean style", "Nigerian event", "Eid", "Diwali")

If BOTH location AND query agree on a culture → all 3 cards should be that culture.
If only query specifies a culture → all 3 cards should be that culture.
If only location gives a cultural hint → blend 2 cultural + 1 global Western card.
If no cultural signal → 3 globally diverse smart cards for the occasion.

════════════════════════════════════════
GLOBAL FASHION TRADITIONS
════════════════════════════════════════

GULF / MIDDLE EAST (Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman):
• Male formal: White thobe (dishdasha/kandura) + bisht cloak; ghutra/keffiyeh headscarf
• Male semi-formal: Premium thobe (cream, grey, navy) + leather Oxford or loafers
• Male modern: Western suits with Gulf flair — dark navy + white kandura-collar detail
• Female formal: Embellished abaya (black, navy, burgundy) + shayla; jewelled sandals
• Female occasion: Maxi gown beneath sheer abaya; statement jewellery
• Key occasions: Eid, Ramadan Iftar, Majlis, National Day, Gulf weddings
• Fabrics: Wool crepe, silk georgette, Egyptian cotton, woven bisht

SOUTH ASIA — INDIA (apply for Chennai, Mumbai, Delhi, Kolkata, Bangalore, Hyderabad, Jaipur, or "Indian"):
• Male festive/wedding: Sherwani (ivory/cream, navy, maroon, gold) + churidar/slim pajama + mojaris/jutti
• Male semi-formal: Silk kurta-pajama + Nehru jacket + kolhapuri sandals or pointed mojaris
• Male smart-casual: Kurta with well-fitted jeans or trousers (India's signature smart casual)
• Female festive: Lehenga choli (for weddings), anarkali suit, silk saree with blouse
• Female semi-formal: Salwar kameez, kurti with palazzo pants, churidar suit
• South Indian specific (Chennai): Silk Kanjivaram saree, veshti (dhoti) for men, jasmine hair garland
• Accessories: Jhumka earrings, bangles, maang tikka, potli bags, dupatta, kolhapuri sandals
• Fabrics: Banarasi silk, Kanjivaram silk, georgette, chiffon, cotton handloom, chanderi

SOUTH ASIA — PAKISTAN:
• Male: Shalwar kameez (white, cream, light blue), achkan coat, embroidered sherwanis for weddings
• Female: Shalwar kameez with dupatta, gharara, farshi pajama, embroidered lawn for daily wear

EAST ASIA — JAPAN (apply for Tokyo, Osaka, Kyoto, or "Japanese"):
• Traditional: Kimono (formal silk), yukata (casual summer cotton), haori jacket, hakama
• Contemporary J-fashion: Minimalist layered textures, Uniqlo/Muji aesthetic
• Harajuku/Shibuya streetwear: Bold proportions, mixed textures, playful accessories, anime/pop references
• Smart Japanese: Clean-cut tailoring, monochromatic palettes, functional accessories

EAST ASIA — KOREA (apply for Seoul, Busan, or "Korean"):
• Traditional: Hanbok (silk, jewel-toned, full skirt for women / wide trousers for men)
• Contemporary K-fashion: Clean oversized coats, fitted basics, wide-leg trousers, earth-toned or pastel palettes
• K-streetwear: Layered crops, sneaker culture, graphic tees, structured outerwear, accessories from GENTLEMONSTER/Gentle Monster

EAST ASIA — CHINA (apply for Beijing, Shanghai, or "Chinese"):
• Traditional: Qipao/cheongsam (female), Tangzhuang jacket (male), hanfu for festivals
• Contemporary: Shanghai modern — tailored Western with Chinese motifs, silk blouses, mandarin collars

SOUTHEAST ASIA:
• Malaysia/Indonesia: Baju melayu (male festive), baju kurung / kebaya (female), batik print shirts
• Vietnam: Áo dài (long silk tunic + trousers, any gender variation)
• Philippines: Barong Tagalog (formal male — embroidered sheer tunic)
• Thailand: Thai silk formal garments; Bangkok casual — relaxed tropical street style

AFRICA — WEST (Lagos, Accra, Dakar, or "Nigerian", "Ghanaian", "African"):
• Male grand formal: Agbada / boubou (wide embroidered robe + inner shirt + trousers)
• Male festive: Ankara/kente print fitted shirt + tailored trousers + loafers
• Male casual: Dashiki + jeans or tailored shorts
• Female: Ankara print wrap dress or two-piece, gele headwrap for formal, iro and buba
• Female formal: Lace blouse + wrapper + gele
• Fabrics: Ankara wax print, kente silk, aso-oke, brocade

AFRICA — EAST (Nairobi, Addis Ababa, or "Kenyan", "Ethiopian"):
• Shuka wraps, kanga fabric wraps, traditional embroidery on cotton
• Contemporary: East African street style — vibrant prints with modern silhouettes

LATIN AMERICA:
• Mexico: Guayabera shirt (male), huipil embroidered top (female), charro formal suit
• Colombia: Ruana wool wrap, pollera dress
• Brazil: Relaxed tropical aesthetic — linen, lightweight cotton, beach-urban crossover

CENTRAL ASIA & CAUCASUS:
• Turkey: Layered Mediterranean elegance, Ottoman-inspired prints, structured coats
• Uzbekistan/Kazakhstan: Chapan embroidered robe, traditional boots, doppa cap

════════════════════════════════════════
SKIN TONE × COLOUR SCIENCE
════════════════════════════════════════
Light/fair: navy, burgundy, forest green, charcoal, dusty rose, camel. Avoid harsh neons.
Light-medium/warm: ecru, camel, rust, terracotta, olive, warm burgundy, gold.
Medium/tan: earth tones, jewel tones (cobalt, emerald), cobalt, terracotta.
Tan/brown: white, ivory, cobalt, burnt orange, mustard, deep teal, gold.
Dark/deep: vibrant jewel tones, bright white, gold, coral, royal purple.

════════════════════════════════════════
WEATHER & FABRIC ADAPTATION
════════════════════════════════════════
Hot/humid (>28°C): lightweight fabrics (linen, cotton, silk, chiffon), breathable silhouettes
Mild (18–28°C): cotton, light knits, layering options
Cool/cold (<18°C): wool, cashmere, structured outerwear, layering
Rainy: practical fabrics, closed shoes, minimal silk

════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════
Generate EXACTLY 3 outfit cards. Return ONLY valid JSON (no markdown, no code fences):

{
  "intent": "2–4 word label for what they need",
  "response": "1–2 sentences explaining what types of fabrics and colors will go well based on the weather, the user's skin tone, gender, and their preference. Do NOT start by explicitly stating the weather (e.g. avoid 'According to today's weather...'). Instead, naturally weave in why certain materials or tones are chosen.",
  "vibe": "3 evocative words",
  "cards": [
    {
      "outfit_name": "Evocative 2–3 word name",
      "style": "Specific style (e.g. 'South Indian Festive', 'K-Fashion Street', 'Gulf Semi-Formal', 'Quiet Luxury')",
      "occasion": "Specific occasion",
      "vibe": "3 precise words",
      "color_scheme": "1 sentence — exact colours and why they complement the user's skin tone",
      "key_colors": ["#hexcode1", "#hexcode2", "#hexcode3"],
      "pieces": {
        "top": "Exact garment with colour, cut, and fabric",
        "bottom": "Exact bottom with cut and fit",
        "shoes": "Exact footwear with colour",
        "accessories": "Key accessories or null",
        "outerwear": "Outerwear or null"
      },
      "why_it_works": "1–2 sentences referencing the user's skin tone or body shape AND the cultural or occasion context specifically",
      "styling_tip": "One specific, physical styling instruction",
      "cultural_note": "Brief cultural dress code or tradition note — or null for standard Western fashion"
    }
  ]
}`

function buildFallbackCards(query: string, gender: string, language: string) {
  const isFemale = gender === 'female'
  const isAr = language === 'ar'
  const lq = query.toLowerCase()

  const isWedding = lq.includes('wedding') || lq.includes('nikah') || lq.includes('زفاف') || lq.includes('عرس')
  const isWork = lq.includes('work') || lq.includes('office') || lq.includes('meeting') || lq.includes('business')
  const isCasual = lq.includes('casual') || lq.includes('weekend') || lq.includes('everyday')
  const isIndian = lq.includes('india') || lq.includes('indian') || lq.includes('chennai') || lq.includes('mumbai') || lq.includes('delhi') || lq.includes('diwali') || lq.includes('sangeet')
  const isGulf = lq.includes('eid') || lq.includes('arabic') || lq.includes('gulf') || lq.includes('dubai') || lq.includes('saudi') || lq.includes('thobe') || lq.includes('abaya')

  if (isIndian && !isFemale) {
    return [
      { outfit_name: isAr ? 'أناقة الشيرواني' : 'Sherwani Elegance', style: 'South Asian Formal', occasion: isWedding ? 'Wedding ceremony' : 'Festive occasion', vibe: isAr ? 'رسمي، تراثي، أنيق' : 'regal, traditional, festive', color_scheme: isAr ? 'عاجي وذهبي مع لمسات حمراء داكنة' : 'Ivory and gold with deep red accents', key_colors: ['#f5f0dc', '#d4af37', '#800020'], pieces: { top: isAr ? 'شيرواني حريري عاجي مع تطريز ذهبي' : 'Ivory silk sherwani with gold embroidery', bottom: isAr ? 'شروال ضيق أو بيجامة بيضاء' : 'Slim churidar or off-white pajama', shoes: isAr ? 'موجاريس أو جوتي مطرزة بالذهب' : 'Gold-embroidered mojaris or jutis', accessories: isAr ? 'ساعة ذهبية وربطة عنق بروش' : 'Gold watch and a brooch pocket square', outerwear: null }, why_it_works: isAr ? 'الذهب والعاجي يعكسان فخامة الاحتفالات الهندية التقليدية.' : 'Ivory and gold capture the grandeur of traditional South Asian celebrations.', styling_tip: isAr ? 'أضف سارفيل بلون عميق لإضفاء الأناقة.' : 'Add a deep-toned safa turban to complete the ceremonial look.', cultural_note: isAr ? 'زي رسمي تقليدي للمناسبات الهندية والباكستانية.' : 'Traditional formal attire for Indian and Pakistani celebrations.' },
      { outfit_name: isAr ? 'كورتا عصرية' : 'Contemporary Kurta', style: 'South Asian Smart Casual', occasion: 'Festive gathering', vibe: isAr ? 'عصري، نظيف، متنوع' : 'modern, clean, versatile', color_scheme: isAr ? 'رمادي داكن مع فضي خفيف' : 'Charcoal with silver thread detail', key_colors: ['#36454f', '#c0c0c0', '#f5f5f5'], pieces: { top: isAr ? 'كورتا قطنية داكنة بياقة ماندارين' : 'Dark charcoal cotton kurta with mandarin collar', bottom: isAr ? 'بنطلون ضيق بيج أو جينز داكن' : 'Slim beige trousers or dark tailored jeans', shoes: isAr ? 'حذاء جلدي بني داكن أو كولهابوري صندل' : 'Dark brown leather loafers or kolhapuri sandals', accessories: isAr ? 'ساعة بسيطة وقميص نهرو بداخله' : 'Minimalist watch, simple ring', outerwear: null }, why_it_works: isAr ? 'الكورتا مع الجينز هو الزي الرسمي غير الرسمي الأيقوني في الهند.' : 'Kurta with slim trousers is India\'s signature smart-casual formula.', styling_tip: isAr ? 'اطوِ الأكمام مرة واحدة لمظهر أكثر استرخاء.' : 'Roll the sleeves once for an effortlessly relaxed finish.', cultural_note: isAr ? 'الكورتا مع الجينز مقبول في معظم المناسبات الهندية.' : 'Kurta with jeans is acceptable at most Indian social occasions.' },
      { outfit_name: isAr ? 'فيوجن الاحتفالات' : 'Festive Fusion', style: 'Indian Fusion', occasion: 'Reception / Cocktail', vibe: isAr ? 'عصري، جريء، احتفالي' : 'modern, bold, celebratory', color_scheme: isAr ? 'كوبالت أزرق مع ذهبي' : 'Cobalt blue with gold accents', key_colors: ['#0047ab', '#d4af37', '#ffffff'], pieces: { top: isAr ? 'قميص نهرو أزرق كوبالت أو بليزر بتطريز خفيف' : 'Cobalt blue Nehru jacket or light embroidered blazer', bottom: isAr ? 'بنطلون أبيض أو كريمي مستقيم' : 'White or cream straight-cut trousers', shoes: isAr ? 'حذاء جلدي أبيض أو موجاريس فضية' : 'White leather Oxfords or silver-tipped mojaris', accessories: isAr ? 'ربطة عنق بروش أو ربطة فراشة ذهبية' : 'Gold bow tie or pocket square in gold silk', outerwear: null }, why_it_works: isAr ? 'مزيج جرئ بين الغربي والشرقي مثالي لحفلات الاستقبال.' : 'A bold East-meets-West fusion perfect for receptions and cocktail events.', styling_tip: isAr ? 'اختر ساعة ذهبية لربط الإطلالة.' : 'A gold watch ties the whole look together beautifully.', cultural_note: isAr ? 'مناسب لحفلات الاستقبال والعشاء الاحتفالي.' : 'Great for receptions, sangeet nights, and cocktail dinners.' },
    ]
  }

  if (isIndian && isFemale) {
    return [
      { outfit_name: isAr ? 'ساري الحرير' : 'Silk Saree Moment', style: 'South Indian Traditional', occasion: isWedding ? 'Wedding ceremony' : 'Festive occasion', vibe: isAr ? 'أنيق، تقليدي، بهيج' : 'graceful, traditional, vibrant', color_scheme: isAr ? 'حرير كانجيفارام بالذهب' : 'Rich Kanjivaram silk in jewel tones with gold zari border', key_colors: ['#8b0000', '#d4af37', '#50c878'], pieces: { top: isAr ? 'بلوزة ساري حريرية مع نقوش ذهبية' : 'Silk saree blouse with gold embroidery and short sleeves', bottom: isAr ? 'ساري حريري كانجيفارام أحمر عميق مع حاشية ذهبية' : 'Deep red Kanjivaram silk saree with gold zari border', shoes: isAr ? 'صندل هندي بالذهب أو حذاء بلة كولهابوري' : 'Gold embellished sandals or kolhapuri heels', accessories: isAr ? 'جومكا أقراط وأساور ذهبية وضفيرة الياسمين' : 'Jhumka earrings, gold bangles, jasmine hair garland, maang tikka', outerwear: null }, why_it_works: isAr ? 'الكانجيفارام الحريري رمز أناقة جنوب الهند للمناسبات الكبرى.' : 'Kanjivaram silk saree is the ultimate South Indian celebration look.', styling_tip: isAr ? 'اعقدي الساري بطريقة نيفاري لتبدو أطول.' : 'Drape the saree in Nivi style and pin the pallu to the shoulder for elegance.', cultural_note: isAr ? 'تقليد جنوب الهند خاصة لحفلات التشيناي.' : 'Classic South Indian tradition — especially appropriate for Chennai weddings.' },
      { outfit_name: isAr ? 'ليهينغا الأحلام' : 'Lehenga Dream', style: 'Bridal / Wedding Guest', occasion: 'Wedding reception', vibe: isAr ? 'رومانسي، ملكي، بهيج' : 'romantic, regal, festive', color_scheme: isAr ? 'وردي فوشيا مع ذهبي' : 'Fuchsia pink with gold embroidery', key_colors: ['#ff007f', '#d4af37', '#f5f0dc'], pieces: { top: isAr ? 'شولي مطرز بالزردوزي مع رقبة بيضاء' : 'Embroidered zardosi choli with sweetheart neckline', bottom: isAr ? 'ليهينغا فوشيا مع طرز ذهبية' : 'Fuchsia flared lehenga with heavy gold embroidery', shoes: isAr ? 'صندل ذهبي مرتفع' : 'Gold block-heel sandals', accessories: isAr ? 'دوباتا شيفون مع مانغ تيكا وأقراط هندية' : 'Chiffon dupatta, maang tikka, layered kundan necklace', outerwear: null }, why_it_works: isAr ? 'الفوشيا يبرز الألوان الدافئة ويضيء الوجه في الصور.' : 'Fuchsia with gold is a showstopping combination for receptions.', styling_tip: isAr ? 'اختاري كعب منخفض للراحة طوال الليل.' : 'Choose block heels over stilettos for comfort through the evening.', cultural_note: isAr ? 'الليهينغا مثالية لحفلات الزفاف الشمالية الهندية والاستقبالات.' : 'Lehenga is ideal for North Indian weddings, sangeet, and reception events.' },
      { outfit_name: isAr ? 'سالوار سوت الأنيق' : 'Elegant Salwar Suit', style: 'South Asian Smart Casual', occasion: 'Semi-formal gathering', vibe: isAr ? 'أنيق، مريح، عصري' : 'elegant, comfortable, polished', color_scheme: isAr ? 'تيل عميق مع تطريز فضي' : 'Deep teal with silver thread embroidery', key_colors: ['#008080', '#c0c0c0', '#f5f5f5'], pieces: { top: isAr ? 'كاميز أنارقالي تيل مع تطريز فضي' : 'Teal anarkali kameez with silver embroidery and V-neck', bottom: isAr ? 'شوريدار ضيق كريمي مع دوباتا مطابق' : 'Cream churidar with matching sheer dupatta', shoes: isAr ? 'جوتي أو صندل فضي' : 'Silver juti flats or embellished sandals', accessories: isAr ? 'أقراط دروب فضية وسوار رقيق' : 'Silver drop earrings and delicate bangles', outerwear: null }, why_it_works: isAr ? 'التيل مثالي للبشرة الدافئة مع لمسات الفضة.' : 'Teal beautifully complements warm and medium skin tones.', styling_tip: isAr ? 'ارتدي الدوباتا على كتف واحد لمظهر عصري.' : 'Pin the dupatta to one shoulder for a modern, polished drape.', cultural_note: isAr ? 'مناسب للمناسبات شبه الرسمية والتجمعات العائلية.' : 'Perfect for semi-formal Indian occasions and family gatherings.' },
    ]
  }

  if (isGulf && !isFemale) {
    return [
      { outfit_name: isAr ? 'ثوب العيد' : 'Eid Thobe', style: 'Gulf Formal', occasion: isAr ? 'العيد والمناسبات الدينية' : 'Eid / Religious occasion', vibe: isAr ? 'نقي، رسمي، تراثي' : 'pure, formal, traditional', color_scheme: isAr ? 'أبيض ناصع مع لمسات فضية' : 'Crisp white with silver trim', key_colors: ['#ffffff', '#c0c0c0', '#d4af37'], pieces: { top: isAr ? 'ثوب قطني أبيض ناصع بتفاصيل دقيقة' : 'Crisp white cotton thobe with fine detailing at collar and cuffs', bottom: isAr ? 'مدمج مع الثوب' : 'Integrated with thobe', shoes: isAr ? 'حذاء جلدي أكسفورد أبيض أو لوفر بيج' : 'White leather Oxfords or beige leather loafers', accessories: isAr ? 'غترة بيضاء مع عقال, ساعة ذهبية' : 'White ghutra with black iqal, gold Rolex or dress watch, silver cufflinks', outerwear: isAr ? 'بشت ذهبي للمناسبات الكبرى' : 'Gold-trimmed bisht for grand occasions' }, why_it_works: isAr ? 'الثوب الأبيض الرسمي هو الزي الخليجي الأيقوني بامتياز.' : 'The crisp white thobe is the iconic formal Gulf attire for celebrations.', styling_tip: isAr ? 'تأكد من أن الثوب مكوى بشكل مثالي — التفاصيل هي كل شيء.' : 'Ensure the thobe is perfectly starched and pressed — the crispness is everything.', cultural_note: isAr ? 'الزي التقليدي الرسمي للمناسبات الدينية والاجتماعية في الخليج.' : 'The traditional formal dress for Gulf religious and social celebrations.' },
      { outfit_name: isAr ? 'ثوب شبه رسمي' : 'Smart Gulf Look', style: 'Gulf Semi-Formal', occasion: isAr ? 'المجلس والتجمعات' : 'Majlis / Social gathering', vibe: isAr ? 'أنيق، هادئ، مريح' : 'polished, understated, elegant', color_scheme: isAr ? 'رمادي فاتح أو كريمي' : 'Light grey or warm cream thobe', key_colors: ['#d3d3d3', '#c19a6b', '#1b2a4a'], pieces: { top: isAr ? 'ثوب رمادي فاتح أو كريمي فاخر' : 'Light grey or warm cream premium thobe', bottom: isAr ? 'مدمج' : 'Integrated', shoes: isAr ? 'لوفر بيج أو بني داكن' : 'Tan or dark brown leather loafers', accessories: isAr ? 'ساعة أنيقة وغترة بيضاء بدون عقال' : 'Elegant dress watch, white ghutra without iqal for relaxed elegance', outerwear: null }, why_it_works: isAr ? 'الألوان المحايدة تعطي مظهراً محترماً ومريحاً في نفس الوقت.' : 'Neutral tones strike the perfect balance between formal respect and relaxed ease.', styling_tip: isAr ? 'اختر قماش لينن للمناخ الحار.' : 'Choose linen or Egyptian cotton for hot weather breathability.', cultural_note: isAr ? 'مناسب للمجالس العائلية والتجمعات الاجتماعية الخليجية.' : 'Ideal for Gulf family gatherings, Majlis, and social visits.' },
      { outfit_name: isAr ? 'عصري خليجي' : 'Modern Gulf Fusion', style: 'Gulf Contemporary', occasion: isAr ? 'مناسبة عصرية' : 'Contemporary social event', vibe: isAr ? 'عصري، أنيق، مميز' : 'modern, sharp, distinguished', color_scheme: isAr ? 'كحلي مع أبيض' : 'Navy suit with white shirt', key_colors: ['#1b2a4a', '#ffffff', '#d4af37'], pieces: { top: isAr ? 'قميص أبيض بياقة مفتوحة' : 'White crisp shirt, open collar', bottom: isAr ? 'بدلة كحلية ضيقة مناسبة' : 'Tailored navy slim suit', shoes: isAr ? 'حذاء أكسفورد جلدي أسود' : 'Black leather Oxford shoes', accessories: isAr ? 'ساعة فاخرة وحزام جلدي أسود' : 'Luxury watch, black leather belt', outerwear: null }, why_it_works: isAr ? 'البدلة الكحلية تلائم أغلب ألوان البشرة وتعطي مظهراً احترافياً.' : 'A navy suit flatters most skin tones and projects confident professionalism.', styling_tip: isAr ? 'لا تضف ربطة عنق للحصول على مظهر عصري.' : 'Skip the tie for a polished contemporary look.', cultural_note: isAr ? 'مناسب للمناسبات المختلطة أو الرسمية الغربية في الخليج.' : 'Appropriate for mixed-dress code events and formal Western contexts in the Gulf.' },
    ]
  }

  // Default: 3 versatile cards for the occasion
  const occasion = isWedding ? 'Wedding' : isWork ? 'Business meeting' : isCasual ? 'Weekend casual' : 'Special occasion'
  if (!isFemale) {
    return [
      { outfit_name: isAr ? 'الأناقة الهادئة' : 'Quiet Luxury', style: 'Quiet Luxury', occasion, vibe: isAr ? 'نظيف، هادئ، راقي' : 'clean, understated, refined', color_scheme: isAr ? 'بيج وكريمي مع فحمي' : 'Camel, cream and charcoal — timeless quiet luxury palette', key_colors: ['#c19a6b', '#f5f0dc', '#36454f'], pieces: { top: isAr ? 'كنزة كشمير بيج أو قميص أبيض' : 'Camel cashmere or merino crew-neck knit or crisp white shirt', bottom: isAr ? 'بنطلون رمادي فحمي مستقيم' : 'Charcoal or dark grey straight-leg tailored trousers', shoes: isAr ? 'لوفر جلدي بني داكن' : 'Dark brown leather loafers', accessories: isAr ? 'ساعة بسيطة وحزام جلدي' : 'Minimal watch, leather belt', outerwear: isAr ? 'معطف صوفي بيج (اختياري)' : 'Camel wool overcoat (optional)' }, why_it_works: isAr ? 'الألوان المحايدة والتصاميم النظيفة لا تفشل أبداً في أي مناسبة.' : 'Neutral tones and clean silhouettes never fail for any occasion.', styling_tip: isAr ? 'اطوِ الأكمام مرتين للحصول على مظهر أكثر استرخاء.' : 'Roll the sleeves twice for a more relaxed, intentional finish.', cultural_note: null },
      { outfit_name: isAr ? 'الكاجوال الأنيق' : 'Smart Casual Sharp', style: 'Smart Casual', occasion, vibe: isAr ? 'متوازن، عملي، أنيق' : 'balanced, versatile, sharp', color_scheme: isAr ? 'نيفي مع أبيض وتان' : 'Navy, white, and tan — a classic three-tone formula', key_colors: ['#1b2a4a', '#f5f5f5', '#c19a6b'], pieces: { top: isAr ? 'قميص أكسفورد أزرق بأزرار أمامية' : 'Navy OCBD button-down shirt, slim fit', bottom: isAr ? 'بنطلون تشينو تان مناسب' : 'Slim tan chinos', shoes: isAr ? 'حذاء أبيض جلدي أو لوفر' : 'White leather sneakers or tan loafers', accessories: isAr ? 'ساعة بسيطة وحزام بني' : 'Simple watch, brown leather belt', outerwear: null }, why_it_works: isAr ? 'المعادلة الكلاسيكية نيفي أبيض تان مضمونة دائماً.' : 'The navy-white-tan formula is timeless and works everywhere.', styling_tip: isAr ? 'اسحب الثوب جزئياً داخل البنطلون (الطريقة الفرنسية).' : 'Half-tuck the shirt for a styled, effortless look.', cultural_note: null },
      { outfit_name: isAr ? 'الأناقة الداكنة' : 'Dark Sophistication', style: 'Contemporary', occasion, vibe: isAr ? 'حديث، جريء، واثق' : 'modern, bold, confident', color_scheme: isAr ? 'أسود وأبيض مع لمسة برغندي' : 'All-dark with a single burgundy accent', key_colors: ['#1a1a1a', '#800020', '#f5f5f5'], pieces: { top: isAr ? 'قميص أسود أو كنزة رفيعة داكنة' : 'Black slim-fit shirt or dark merino turtleneck', bottom: isAr ? 'بنطلون أسود مناسب' : 'Black tailored slim trousers', shoes: isAr ? 'بوت تشيلسي جلدي أسود' : 'Black leather Chelsea boots', accessories: isAr ? 'ساعة فضية وحزام أسود' : 'Silver watch, black belt', outerwear: null }, why_it_works: isAr ? 'المونوكروم الداكن يطيل القامة ويعطي مظهراً واثقاً.' : 'Dark monochrome elongates the silhouette and projects quiet confidence.', styling_tip: isAr ? 'أضف حزام برغندي كلمسة مميزة.' : 'Add a burgundy leather belt as the single distinctive accent.', cultural_note: null },
    ]
  }

  return [
    { outfit_name: isAr ? 'الرقي الهادئ' : 'Quiet Power', style: 'Quiet Luxury', occasion, vibe: isAr ? 'نظيف، راقي، هادئ' : 'clean, refined, effortless', color_scheme: isAr ? 'كريمي وبيج مع بني دافئ' : 'Cream, oatmeal, and warm brown — tonal quiet luxury', key_colors: ['#f5f0dc', '#c19a6b', '#8b6914'], pieces: { top: isAr ? 'بلوزة حريرية كريمية أو كنزة كشمير' : 'Cream silk blouse or fine cashmere knit', bottom: isAr ? 'بنطلون بيج واسع ومقصوص' : 'Tailored wide-leg oatmeal trousers', shoes: isAr ? 'باليه فلات بيج أو لوفر جلدي بني' : 'Beige ballet flats or tan leather loafers', accessories: isAr ? 'ساعة ذهبية وحقيبة صغيرة جلدية' : 'Gold watch, small leather shoulder bag', outerwear: null }, why_it_works: isAr ? 'التناغم اللوني الدافئ يضفي أناقة راسخة.' : 'Tonal warm neutrals create an effortlessly polished silhouette.', styling_tip: isAr ? 'اثني الأكمام لإظهار المعصم.' : 'Fold the cuffs back to show the wrist and break the proportion.', cultural_note: null },
    { outfit_name: isAr ? 'الكاجوال الأنيق' : 'Clean Girl Energy', style: 'Clean Minimal', occasion, vibe: isAr ? 'عصري، نظيف، مرتب' : 'modern, sleek, polished', color_scheme: isAr ? 'أبيض مع رمادي وذهبي' : 'White and light grey with gold accessories', key_colors: ['#ffffff', '#d3d3d3', '#d4af37'], pieces: { top: isAr ? 'تيشيرت أو بلوزة بيضاء نظيفة' : 'White fitted tank or clean white tee', bottom: isAr ? 'بنطلون رمادي فاتح واسع' : 'Light grey wide-leg tailored trousers or midi skirt', shoes: isAr ? 'حذاء رياضي أبيض أو باليه' : 'White leather sneakers or white ballet flats', accessories: isAr ? 'أقراط ذهبية صغيرة وحزام رفيع' : 'Small gold hoop earrings, thin gold chain, minimal tote', outerwear: null }, why_it_works: isAr ? 'التصميم النظيف يمنحك مظهراً محترماً دون جهد.' : 'Clean minimalism creates an effortless, put-together look for any occasion.', styling_tip: isAr ? 'اسحبي الثوب جزئياً داخل البنطلون لتحديد الخصر.' : 'Half-tuck the top to define the waist and add structure.', cultural_note: null },
    { outfit_name: isAr ? 'أناقة المساء' : 'Evening Edit', style: 'Contemporary Chic', occasion, vibe: isAr ? 'جريئ، أنيق، ساحر' : 'bold, striking, confident', color_scheme: isAr ? 'أسود مع لمسة من البرغندي' : 'All-black with a single rich colour accent', key_colors: ['#1a1a1a', '#800020', '#ffffff'], pieces: { top: isAr ? 'بلوزة سوداء أنيقة بياقة عميقة' : 'Black sleek blouse or fitted black knit', bottom: isAr ? 'تنورة ميدي سوداء أو بنطلون ضيق' : 'Black midi skirt or tailored slim trousers', shoes: isAr ? 'كعب بلوك أسود أو حذاء بوت تشيلسي' : 'Black block-heel mules or chelsea ankle boots', accessories: isAr ? 'قلادة كبيرة أو حلق درامي' : 'Statement necklace or bold earrings — not both', outerwear: null }, why_it_works: isAr ? 'الأسود المونوكروم مضمون دائماً ومريح في كل الأجسام.' : 'All-black creates a sleek, elongating silhouette that works on every body type.', styling_tip: isAr ? 'أضف قطعة واحدة ملونة فقط تكون هي محور الإطلالة.' : 'Pick one statement accessory — the rest should recede.', cultural_note: null },
  ]
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, window: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const { query, name, gender, skin_tone, body_shape, height, style_pref, history, language, weather } = body
    const responseLanguage = language === 'ar' ? 'Arabic' : 'English'
    if (!query || typeof query !== 'string') return NextResponse.json({ error: 'query required' }, { status: 400 })
    const weatherSummary = buildWeatherSummary(weather, language)

    const priorTurns: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(history) ? history : []
    const firstName = (name || 'there').split(' ')[0]

    // ── Off-topic ──
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

    // ── Advice mode ──
    if (isAdviceQuery(query)) {
      const userProfile = [
        `Name: ${firstName}`,
        `Gender: ${gender || 'male'}`,
        skin_tone  && `Skin tone: ${skin_tone}`,
        body_shape && `Body shape: ${body_shape}`,
        height     && `Height: ${height}`,
        style_pref && `Style preference: ${style_pref}`,
        weatherSummary && `Weather: ${weatherSummary}`,
      ].filter(Boolean).join('\n')

      try {
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
        const localAdvice = buildLocalAdviceResponse({
          query, name: firstName, skinTone: skin_tone, bodyShape: body_shape, language,
        })
        const adviceText = withWeatherOpening(parsed?.response || result.content.trim(), weather, language)
        const colors = Array.isArray(parsed?.colors) && parsed.colors.length ? parsed.colors : localAdvice.colors

        if (adviceText) {
          return NextResponse.json({
            mode: 'advice', intent: query, response: adviceText, colors, suggestions: [], vibe: '', provider: result.provider,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.warn('[outfit-search] advice fallback:', message)
      }

      const localAdvice = buildLocalAdviceResponse({ query, name: firstName, skinTone: skin_tone, bodyShape: body_shape, language })
      return NextResponse.json({
        ...localAdvice,
        response: withWeatherOpening(localAdvice.response, weather, language),
      })
    }

    // ── Cards mode — world fashion curation ───────────────────────────────────
    const userProfile = [
      `Name: ${firstName}`,
      `Gender: ${gender || 'male'}`,
      skin_tone  && `Skin tone: ${skin_tone}`,
      body_shape && `Body shape: ${body_shape}`,
      height     && `Height: ${height}`,
      style_pref && `Style preference: ${style_pref}`,
      weatherSummary && `Current weather/location: ${weatherSummary}`,
    ].filter(Boolean).join('\n')

    const prompt = `USER PROFILE:
${userProfile}

USER REQUEST: "${query}"

Generate 3 outfit cards for this request. Detect cultural context from both the weather city and query. All user-facing text must be in ${responseLanguage}.
Return ONLY the JSON object — no markdown, no explanation.`

    try {
      const result = await chatWithFallback(
        [
          { role: 'system', content: CARDS_SYSTEM },
          ...priorTurns,
          { role: 'user', content: prompt },
        ],
        { maxTokens: 2000, temperature: 0.75 },
      )

      const parsed = extractJSON(result.content)
      if (parsed?.cards?.length) {
        return NextResponse.json({
          mode: 'cards',
          intent: parsed.intent || query,
          response: withWeatherOpening(parsed.response, weather, language),
          vibe: parsed.vibe || '',
          suggestions: [],
          cards: parsed.cards,
          provider: result.provider,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.warn('[outfit-search] cards fallback:', message)
    }

    // Local fallback: return 3 generic cards so the user always gets something
    const fallbackCards = buildFallbackCards(query, gender || 'male', language || 'en')
    return NextResponse.json({
      mode: 'cards',
      intent: query,
      response: language === 'ar' 
        ? 'لقد اخترت لك أقمشة وألوان تناسب الطقس الحالي وتلائم ذوقك.' 
        : "I've chosen breathable fabrics and colors tailored to the current weather and your profile. Here are some looks:",
      vibe: '',
      suggestions: [],
      cards: fallbackCards,
    })
  } catch (err: any) {
    console.error('[outfit-search]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
