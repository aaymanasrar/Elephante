import { optionalEnv, requireEnv } from '@/lib/env'

export interface AnalyzeWardrobeResponse {
  perfect_visual_prompt?: string
  cultural_tags?: string[]
  cultural_context?: string
  style_origin?: string
  occasion_arabic?: string
  formality_level?: string
  [key: string]: any
}

/**
 * Call the custom Render AI /analyze endpoint for enhanced wardrobe analysis.
 * Falls back gracefully if the server is unavailable.
 */
export async function analyzeWardrobeWithAIServer(
  imageUrl: string,
  itemName: string,
  itemType: string,
  color: string,
  occasion: string,
): Promise<AnalyzeWardrobeResponse | null> {
  const aiServerUrl = optionalEnv('NEXT_PUBLIC_AI_MODEL_URL')
  if (!aiServerUrl) {
    console.warn('[analyzeWardrobe] NEXT_PUBLIC_AI_MODEL_URL not configured — skipping AI analysis')
    return null
  }

  try {
    const response = await fetch(`${aiServerUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        item_name: itemName,
        item_type: itemType,
        color,
        occasion,
      }),
      signal: AbortSignal.timeout(30_000), // 30-second timeout
    })

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText)
      console.warn(
        `[analyzeWardrobe] Server responded ${response.status}: ${error}`,
      )
      return null
    }

    const data = (await response.json()) as AnalyzeWardrobeResponse
    return data
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[analyzeWardrobe] Failed to reach AI server: ${message}`)
    return null
  }
}

/**
 * Generate a Stylist's Vision image using Pollinations API.
 * Requires a valid prompt (typically from perfect_visual_prompt).
 */
export function generateStylistsVisionUrl(prompt: string): string {
  if (!prompt) throw new Error('Prompt is required for Stylist\'s Vision image')
  const encoded = encodeURIComponent(prompt)
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`
}

/**
 * Extract cultural tags from AI analysis and format for display.
 */
export function formatCulturalTags(response: AnalyzeWardrobeResponse): string[] {
  const tags: string[] = []

  // Direct cultural tags from response
  if (Array.isArray(response.cultural_tags)) {
    tags.push(...response.cultural_tags.filter(Boolean))
  }

  // Generate synthetic cultural tags from context
  if (response.cultural_context) {
    tags.push(response.cultural_context)
  }

  if (response.style_origin) {
    tags.push(response.style_origin)
  }

  // Add formality if available
  if (response.formality_level) {
    tags.push(response.formality_level)
  }

  // Deduplicate and limit to 5 tags
  const unique = Array.from(new Set(tags))
  return unique.slice(0, 5)
}
