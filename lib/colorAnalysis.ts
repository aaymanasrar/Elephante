import sharp from 'sharp'

export interface ColorResult {
  hex: string
  name: string
  percentage: number
}

interface RGB {
  r: number
  g: number
  b: number
}

const NAMED_COLORS: [string, RGB][] = [
  ['red',      { r: 220, g:  20, b:  60 }],
  ['orange',   { r: 255, g: 140, b:   0 }],
  ['yellow',   { r: 255, g: 215, b:   0 }],
  ['green',    { r:  60, g: 179, b: 113 }],
  ['blue',     { r:  70, g: 130, b: 180 }],
  ['purple',   { r: 128, g:   0, b: 128 }],
  ['pink',     { r: 255, g: 105, b: 180 }],
  ['brown',    { r: 139, g:  90, b:  43 }],
  ['black',    { r:  20, g:  20, b:  20 }],
  ['white',    { r: 240, g: 240, b: 240 }],
  ['grey',     { r: 128, g: 128, b: 128 }],
  ['beige',    { r: 245, g: 245, b: 220 }],
  ['cream',    { r: 255, g: 253, b: 208 }],
  ['navy',     { r:   0, g:   0, b: 128 }],
  ['olive',    { r: 128, g: 128, b:   0 }],
  ['teal',     { r:   0, g: 128, b: 128 }],
  ['coral',    { r: 255, g: 127, b:  80 }],
  ['burgundy', { r: 128, g:   0, b:  32 }],
  ['camel',    { r: 193, g: 154, b: 107 }],
  ['gold',     { r: 255, g: 215, b:   0 }],
  ['silver',   { r: 192, g: 192, b: 192 }],
]

function dist(a: RGB, b: RGB): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
}

function closestNamedColor(color: RGB): string {
  let best = 'black'
  let bestDist = Infinity
  for (const [name, ref] of NAMED_COLORS) {
    const d = dist(color, ref)
    if (d < bestDist) { bestDist = d; best = name }
  }
  return best
}

function toHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')
}

function nearestCentroid(pixel: RGB, centroids: RGB[]): number {
  let nearest = 0
  let minDist = Infinity
  for (let c = 0; c < centroids.length; c++) {
    const d = dist(pixel, centroids[c]!)
    if (d < minDist) { minDist = d; nearest = c }
  }
  return nearest
}

function kMeans(pixels: RGB[], k: number, iterations = 3): { centroids: RGB[]; counts: number[] } {
  if (pixels.length === 0) return { centroids: [], counts: [] }

  const step = Math.max(1, Math.floor(pixels.length / k))
  const centroids: RGB[] = Array.from({ length: k }, (_, i) => {
    const px = pixels[Math.min(i * step, pixels.length - 1)]!
    return { r: px.r, g: px.g, b: px.b }
  })

  for (let iter = 0; iter < iterations; iter++) {
    const sums: { r: number; g: number; b: number; n: number }[] = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, n: 0 }))
    for (const pixel of pixels) {
      const c = nearestCentroid(pixel, centroids)
      const s = sums[c]!
      s.r += pixel.r; s.g += pixel.g; s.b += pixel.b; s.n++
    }
    for (let c = 0; c < k; c++) {
      const s = sums[c]!
      if (s.n > 0) centroids[c] = { r: s.r / s.n, g: s.g / s.n, b: s.b / s.n }
    }
  }

  const counts: number[] = new Array<number>(k).fill(0)
  for (const pixel of pixels) counts[nearestCentroid(pixel, centroids)]!++

  return { centroids, counts }
}

export async function extractDominantColors(imageUrl: string, nColors = 5): Promise<ColorResult[]> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const buf = Buffer.from(await response.arrayBuffer())
    const { data, info } = await sharp(buf).resize(100, 100, { fit: 'cover' }).raw().toBuffer({ resolveWithObject: true })

    const ch = info.channels
    const pixels: RGB[] = []
    for (let i = 0; i + 2 < data.length; i += ch) {
      if (ch === 4 && (data[i + 3] ?? 255) < 64) continue
      pixels.push({ r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 })
    }

    if (pixels.length === 0) return [{ hex: '#000000', name: 'black', percentage: 100 }]

    const k = Math.min(nColors, pixels.length)
    const { centroids, counts } = kMeans(pixels, k, 3)
    const total = counts.reduce((a, b) => a + b, 0)

    return centroids
      .map((c, i) => ({
        hex: toHex(c),
        name: closestNamedColor(c),
        percentage: total > 0 ? Math.round(((counts[i] ?? 0) / total) * 100) : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage)
  } catch {
    return [{ hex: '#000000', name: 'black', percentage: 100 }]
  }
}
