// Maps city → region → brands actually available in retail stores there.
// Used to constrain AI brand suggestions to what users can realistically shop.

type RegionBrands = {
  region: string
  brands: string[]
}

const REGION_MAP: Record<string, RegionBrands> = {
  gulf: {
    region: 'Gulf region (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman)',
    brands: [
      'Zara', 'H&M', 'Mango', 'Uniqlo', 'Pull&Bear', 'Bershka',
      'River Island', 'Ralph Lauren', 'Tommy Hilfiger', 'Lacoste',
      'Nike', 'Adidas', 'New Balance', 'Vans', 'Converse', "Levi's",
      'Ted Baker', 'Reiss',
    ],
  },
  india: {
    region: 'India',
    brands: [
      'Zara', 'H&M', 'Mango', 'Uniqlo', 'Nike', 'Adidas',
      'New Balance', "Levi's", 'Vans', 'Converse', 'Pull&Bear', 'Bershka',
    ],
  },
  pakistan: {
    region: 'Pakistan',
    brands: ['H&M', 'Zara', 'Nike', 'Adidas', "Levi's", 'Converse', 'Vans', 'Mango'],
  },
  uk: {
    region: 'United Kingdom',
    brands: [
      'Zara', 'H&M', 'Mango', 'COS', 'Arket', 'River Island',
      'Reiss', 'Ted Baker', 'Ralph Lauren', 'Tommy Hilfiger', 'Lacoste',
      "Levi's", 'Nike', 'Adidas', 'New Balance', 'Vans', 'Converse',
      'Pull&Bear', 'Bershka', "Arc'teryx", 'Stone Island', 'CP Company',
      'Acne Studios', 'A.P.C', 'Ami Paris', 'Dr. Martens', 'Timberland',
    ],
  },
  us: {
    region: 'United States',
    brands: [
      'Zara', 'H&M', 'Mango', 'COS', 'Arket', 'Ralph Lauren',
      'Tommy Hilfiger', 'Lacoste', "Levi's", 'Nike', 'Adidas', 'New Balance',
      'Vans', 'Converse', 'Reiss', 'Ted Baker', "Arc'teryx", 'Uniqlo',
      'Stone Island', 'CP Company', 'Acne Studios', 'A.P.C', 'Ami Paris',
      'Dr. Martens', 'Timberland',
    ],
  },
  europe: {
    region: 'Europe',
    brands: [
      'Zara', 'H&M', 'Mango', 'COS', 'Arket', 'Pull&Bear', 'Bershka',
      'Ami Paris', 'Acne Studios', 'A.P.C', 'Nike', 'Adidas', 'New Balance',
      'Vans', 'Converse', "Levi's", "Arc'teryx", 'Stone Island', 'CP Company',
      'Lacoste', 'Ralph Lauren', 'Tommy Hilfiger', 'Dr. Martens', 'Timberland',
    ],
  },
  japan: {
    region: 'Japan',
    brands: [
      'Uniqlo', 'Zara', 'H&M', 'Nike', 'Adidas', 'New Balance',
      'Vans', 'Converse', "Levi's", "Arc'teryx", 'Mango',
    ],
  },
  korea: {
    region: 'South Korea',
    brands: [
      'Zara', 'H&M', 'Mango', 'Uniqlo', 'Nike', 'Adidas',
      'New Balance', 'Converse', "Levi's", 'Vans',
    ],
  },
  china: {
    region: 'China',
    brands: [
      'Zara', 'H&M', 'Uniqlo', 'Nike', 'Adidas', 'New Balance',
      'Converse', "Levi's", 'Vans', 'Mango', 'Ralph Lauren', 'Lacoste',
    ],
  },
  southeast_asia: {
    region: 'Southeast Asia',
    brands: [
      'Zara', 'H&M', 'Mango', 'Uniqlo', 'Nike', 'Adidas',
      'New Balance', 'Converse', "Levi's", 'Vans', 'Pull&Bear', 'Bershka',
    ],
  },
  africa: {
    region: 'Africa',
    brands: [
      'Nike', 'Adidas', 'Converse', "Levi's", 'Zara', 'H&M', 'Vans',
    ],
  },
  australia: {
    region: 'Australia / New Zealand',
    brands: [
      'Zara', 'H&M', 'Uniqlo', 'COS', 'Mango', 'Nike',
      'Adidas', 'New Balance', "Levi's", 'Vans', 'Converse', "Arc'teryx",
      'Ralph Lauren', 'Tommy Hilfiger', 'Lacoste', 'Dr. Martens', 'Timberland',
    ],
  },
  canada: {
    region: 'Canada',
    brands: [
      'Zara', 'H&M', 'COS', 'Arket', 'Mango', 'Ralph Lauren',
      'Tommy Hilfiger', 'Lacoste', "Levi's", 'Nike', 'Adidas', 'New Balance',
      'Vans', 'Converse', "Arc'teryx", 'Uniqlo', 'Ted Baker',
    ],
  },
  turkey: {
    region: 'Turkey',
    brands: [
      'Zara', 'H&M', 'Mango', 'Pull&Bear', 'Bershka', 'Nike', 'Adidas',
      'New Balance', "Levi's", 'Converse', 'Vans', 'Tommy Hilfiger', 'Lacoste',
    ],
  },
}

// City → region key
const CITY_REGION: Record<string, string> = {
  // Gulf
  dubai: 'gulf', 'abu dhabi': 'gulf', sharjah: 'gulf', ajman: 'gulf',
  riyadh: 'gulf', jeddah: 'gulf', mecca: 'gulf', medina: 'gulf', dammam: 'gulf',
  doha: 'gulf', kuwait: 'gulf', 'kuwait city': 'gulf',
  muscat: 'gulf', manama: 'gulf', 'ras al khaimah': 'gulf',

  // India
  mumbai: 'india', delhi: 'india', 'new delhi': 'india', bangalore: 'india',
  bengaluru: 'india', chennai: 'india', hyderabad: 'india', kolkata: 'india',
  pune: 'india', jaipur: 'india', ahmedabad: 'india', surat: 'india',
  lucknow: 'india', kochi: 'india', chandigarh: 'india',

  // Pakistan
  karachi: 'pakistan', lahore: 'pakistan', islamabad: 'pakistan',
  rawalpindi: 'pakistan', faisalabad: 'pakistan', peshawar: 'pakistan',

  // UK
  london: 'uk', manchester: 'uk', birmingham: 'uk', edinburgh: 'uk',
  glasgow: 'uk', leeds: 'uk', bristol: 'uk', liverpool: 'uk',
  sheffield: 'uk', newcastle: 'uk',

  // US
  'new york': 'us', 'los angeles': 'us', chicago: 'us', houston: 'us',
  miami: 'us', 'san francisco': 'us', seattle: 'us', boston: 'us',
  dallas: 'us', atlanta: 'us', denver: 'us', phoenix: 'us',
  'las vegas': 'us', portland: 'us', austin: 'us',

  // Canada
  toronto: 'canada', vancouver: 'canada', montreal: 'canada',
  calgary: 'canada', ottawa: 'canada',

  // Europe
  paris: 'europe', berlin: 'europe', milan: 'europe', rome: 'europe',
  madrid: 'europe', barcelona: 'europe', amsterdam: 'europe',
  vienna: 'europe', zurich: 'europe', brussels: 'europe',
  stockholm: 'europe', oslo: 'europe', copenhagen: 'europe',
  lisbon: 'europe', prague: 'europe', warsaw: 'europe', athens: 'europe',
  budapest: 'europe', munich: 'europe', frankfurt: 'europe', hamburg: 'europe',

  // Japan
  tokyo: 'japan', osaka: 'japan', kyoto: 'japan', yokohama: 'japan',
  nagoya: 'japan', sapporo: 'japan', fukuoka: 'japan',

  // Korea
  seoul: 'korea', busan: 'korea', incheon: 'korea',

  // China
  beijing: 'china', shanghai: 'china', guangzhou: 'china', shenzhen: 'china',
  chengdu: 'china', hangzhou: 'china',

  // Southeast Asia
  singapore: 'southeast_asia', bangkok: 'southeast_asia',
  'kuala lumpur': 'southeast_asia', jakarta: 'southeast_asia',
  manila: 'southeast_asia', 'ho chi minh': 'southeast_asia', hanoi: 'southeast_asia',

  // Africa
  lagos: 'africa', nairobi: 'africa', accra: 'africa',
  'cape town': 'africa', johannesburg: 'africa', cairo: 'africa',
  casablanca: 'africa', addis: 'africa', dar: 'africa',

  // Australia
  sydney: 'australia', melbourne: 'australia', brisbane: 'australia',
  perth: 'australia', adelaide: 'australia', auckland: 'australia',

  // Turkey
  istanbul: 'turkey', ankara: 'turkey', izmir: 'turkey',
}

function findRegionKey(text: string): string | null {
  const lower = text.toLowerCase().trim()
  const match = Object.keys(CITY_REGION).find((k) => lower.includes(k))
  return match ? (CITY_REGION[match] ?? null) : null
}

export function getBrandsForCity(city: string | null | undefined): { regionNote: string; brandList: string[] } | null {
  if (!city) return null
  const regionKey = findRegionKey(city)
  if (!regionKey) return null
  const data = REGION_MAP[regionKey]
  if (!data) return null
  return { regionNote: data.region, brandList: data.brands }
}

/** Extracts the first recognisable city name from freeform query text. */
export function extractCityFromQuery(query: string): string | null {
  if (!query) return null
  const lower = query.toLowerCase()
  // Sort by length descending so "new york" matches before "york"
  const sorted = Object.keys(CITY_REGION).sort((a, b) => b.length - a.length)
  const match = sorted.find((city) => lower.includes(city))
  return match ?? null
}
