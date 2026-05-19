import sharp from 'sharp'

/**
 * Downloads a web image or parses a data URL into a Buffer.
 */
async function getBuffer(urlOrDataUrl: string): Promise<Buffer> {
  if (urlOrDataUrl.startsWith('data:')) {
    const base64Data = urlOrDataUrl.split(',')[1]
    if (!base64Data) throw new Error('Invalid Data URL')
    return Buffer.from(base64Data, 'base64')
  }

  const response = await fetch(urlOrDataUrl, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`Failed to fetch image from ${urlOrDataUrl}`)
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Composites a user's transparent avatar (like an iOS Memoji) onto the mannequin head of a generated outfit image.
 * 
 * @param mainImageUrl The generated mannequin image (web URL or base64 data URL)
 * @param avatarUrl The user's custom avatar image (web URL or base64 data URL)
 * @returns The composited image as a base64 Data URL (PNG), or the original image if the process fails.
 */
export async function compositeAvatar(
  mainImageUrl: string,
  avatarUrl: string | null | undefined
): Promise<string> {
  if (!avatarUrl) return mainImageUrl

  try {
    // 1. Load main image and avatar buffers
    const mainBuffer = await getBuffer(mainImageUrl)
    const avatarBuffer = await getBuffer(avatarUrl)

    // 2. Query main image dimensions
    const mainImage = sharp(mainBuffer)
    const { width, height } = await mainImage.metadata()
    if (!width || !height) return mainImageUrl

    // 3. Compute premium proportional positioning:
    // Mannequin head width is typically around 15% of the total canvas width.
    const avatarWidth = Math.round(width * 0.15)
    const avatarHeight = avatarWidth // Keep it square

    // Center horizontally, place at ~10% from the top (where the mannequin head is located)
    const left = Math.round((width - avatarWidth) / 2)
    const top = Math.round(height * 0.10)

    // 4. Resize avatar and overlay it
    const resizedAvatar = await sharp(avatarBuffer)
      .resize(avatarWidth, avatarHeight, { fit: 'inside' })
      .toBuffer()

    const compositedBuffer = await mainImage
      .composite([{
        input: resizedAvatar,
        left,
        top,
      }])
      .png({ compressionLevel: 8 })
      .toBuffer()

    return `data:image/png;base64,${compositedBuffer.toString('base64')}`
  } catch (err) {
    console.warn('[avatar-composition] Failed to composite custom avatar:', err)
    return mainImageUrl
  }
}
