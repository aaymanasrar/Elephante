export function hasTogetherImageConfig(): boolean {
  return Boolean(process.env.TOGETHER_API_KEY)
}

export async function generateTogetherImage(prompt: string): Promise<{ url: string }> {
  const apiKey = process.env.TOGETHER_API_KEY
  if (!apiKey) throw new Error('TOGETHER_API_KEY not set')

  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell-Free',
      prompt,
      width: 512,
      height: 768,
      steps: 4,
      n: 1,
      response_format: 'url',
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Together AI ${response.status}: ${text}`)
  }

  const data = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> }
  const item = data.data?.[0]
  if (!item) throw new Error('Together AI returned no image')

  if (item.url) return { url: item.url }
  if (item.b64_json) return { url: `data:image/png;base64,${item.b64_json}` }
  throw new Error('Together AI: no url or b64_json in response')
}
