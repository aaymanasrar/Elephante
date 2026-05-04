const MEMORY_KEY = 'elephante_search_memory'

type SearchMemory = Record<string, { keywords: string[]; boosted: string[] }>

let memoryCache: SearchMemory | null = null
let persistHandle: number | null = null

function loadMemory(): SearchMemory {
  if (memoryCache) return memoryCache

  try {
    memoryCache = JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}')
  } catch {
    memoryCache = {}
  }

  return memoryCache!
}

function persistMemorySoon() {
  const persist = () => {
    persistHandle = null
    if (!memoryCache) return
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(memoryCache))
    } catch {}
  }

  if (persistHandle !== null) return

  const idleCallback = globalThis.requestIdleCallback
  if (typeof idleCallback === 'function') {
    persistHandle = idleCallback(persist) as unknown as number
  } else {
    persistHandle = window.setTimeout(persist, 0)
  }
}

export function saveSearchClick(intent: string, keywords: string[], outfitId: string) {
  const mem = loadMemory()
  const key = intent.toLowerCase().trim()
  const entry = mem[key] || { keywords, boosted: [] }

  if (!entry.boosted.includes(outfitId)) entry.boosted.push(outfitId)
  entry.keywords = keywords
  mem[key] = entry

  persistMemorySoon()
}

export function getBoostedOutfits(intent: string): string[] {
  const mem = loadMemory()
  const key = intent.toLowerCase().trim()
  if (mem[key]) return mem[key].boosted

  const words = key.split(' ')
  for (const [storedIntent, entry] of Object.entries(mem)) {
    if (words.some(word => storedIntent.includes(word) || (entry.keywords || []).includes(word))) {
      return entry.boosted
    }
  }

  return []
}
