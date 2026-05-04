type OutfitImagePromptOptions = {
  gender?: string | null
  pieces: Array<string | null | undefined>
  style?: string | null
  colorScheme?: string | null
  colors?: Array<string | null | undefined> | string | null
  extraDetails?: Array<string | null | undefined>
}

function normalizePiece(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'null') return null
  return trimmed
}

function mannequinForGender(gender?: string | null) {
  const normalized = (gender || '').toLowerCase()
  if (normalized === 'female') return 'female-proportioned smooth matte white faceless mannequin'
  if (normalized === 'male') return 'male-proportioned smooth matte white faceless mannequin'
  return 'smooth matte white faceless fashion mannequin'
}

function normalizeColors(colors: OutfitImagePromptOptions['colors']) {
  if (Array.isArray(colors)) {
    return colors.map(normalizePiece).filter((color): color is string => Boolean(color)).join(', ')
  }

  return normalizePiece(colors)
}

export function buildCatalogMannequinImagePrompt({
  gender,
  pieces,
  style,
  colorScheme,
  colors,
  extraDetails = [],
}: OutfitImagePromptOptions) {
  const cleanedPieces = pieces.map(normalizePiece).filter((piece): piece is string => Boolean(piece))
  const colorText = normalizeColors(colors)

  return [
    'Full-body retail catalog product photo matching a fashion database archive',
    `${mannequinForGender(gender)} with a simple blank mannequin head`,
    cleanedPieces.length ? `wearing ${cleanedPieces.join(', ')}` : null,
    normalizePiece(style) ? `${normalizePiece(style)} styling` : null,
    normalizePiece(colorScheme) ? `color palette: ${normalizePiece(colorScheme)}` : null,
    colorText ? `key colors: ${colorText}` : null,
    ...extraDetails.map(normalizePiece),
    'pure white seamless studio background',
    'centered straight-on composition with the entire outfit visible from head to shoes',
    'soft even studio lighting, realistic garment texture, crisp product-photo detail',
    'only a faint natural floor contact shadow',
    'no human model, no facial features, no hair, no skin, no scenery, no props, no text, no watermark, no logo overlay',
  ].filter(Boolean).join('. ')
}
