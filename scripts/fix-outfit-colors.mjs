/**
 * fix-outfit-colors.mjs
 * Corrects hex_colors for all excel_outfits by analyzing the actual image
 * through vision AI (Groq → Gemini fallback).
 *
 * Run: node scripts/fix-outfit-colors.mjs
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Load .env.local
const __dir = dirname(fileURLToPath(import.meta.url))
try {
  const raw = readFileSync(join(__dir, '..', '.env.local'), 'utf8')
  raw.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eq = trimmed.indexOf('=')
    if (eq === -1) return
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    process.env[k] = v
  })
} catch (e) { console.error('Could not load .env.local:', e.message); process.exit(1) }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
  timeout: 30000, maxRetries: 0,
})

const gemini = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  timeout: 30000, maxRetries: 0,
})

const PROMPT = `Look at this outfit photo. Return ONLY a raw JSON object — no markdown, no explanation:
{"key_colors":["#hex1","#hex2","#hex3"],"color_names":["Name1","Name2","Name3"]}
Rules: extract the 3 most dominant colors actually visible in the clothing/shoes/accessories. Hex codes must match what you see. color_names: simple English (e.g. Navy, Burnt Orange, Olive, Charcoal, Cream).`

async function imageExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch { return false }
}

async function visionCall(client, model, imageUrl) {
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: imageUrl } },
      { type: 'text', text: PROMPT },
    ]}],
    max_tokens: 120,
  })
  const raw = res.choices[0]?.message?.content || ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('no JSON in response')
  const parsed = JSON.parse(match[0])
  if (!parsed.key_colors?.length) throw new Error('empty key_colors')
  return parsed
}

async function getColors(imageUrl) {
  // Try Groq first
  try {
    return await visionCall(groq, 'meta-llama/llama-4-scout-17b-16e-instruct', imageUrl)
  } catch (e1) {
    // Fallback to Gemini
    try {
      return await visionCall(gemini, 'gemini-2.0-flash', imageUrl)
    } catch (e2) {
      throw new Error(`Groq: ${e1.message} | Gemini: ${e2.message}`)
    }
  }
}

async function run() {
  console.log('Fetching all excel_outfits with images...')
  const { data: outfits, error } = await supabase
    .from('excel_outfits')
    .select('id, image_url')
    .not('image_url', 'is', null)

  if (error) { console.error('Supabase error:', error.message); process.exit(1) }
  console.log(`Found ${outfits.length} outfits.\n`)

  let updated = 0, skipped = 0, failed = 0

  for (let i = 0; i < outfits.length; i++) {
    const { id, image_url } = outfits[i]
    const idx = `[${i + 1}/${outfits.length}]`
    process.stdout.write(`${idx} ${id.slice(0, 8)}... `)

    // Check image exists
    const exists = await imageExists(image_url)
    if (!exists) {
      console.log('⚠  image 404 — skipped')
      skipped++
      continue
    }

    try {
      const result = await getColors(image_url)
      const { error: dbErr } = await supabase
        .from('excel_outfits')
        .update({ hex_colors: result.key_colors })
        .eq('id', id)

      if (dbErr) throw new Error(dbErr.message)
      console.log(`✓  ${result.color_names?.join(', ')}`)
      updated++
    } catch (err) {
      console.log(`❌ ${err.message.slice(0, 80)}`)
      failed++
    }

    // 4s gap — safe for Groq free tier (~15 req/min, well under the 30/min limit)
    await new Promise(r => setTimeout(r, 4000))
  }

  console.log(`\n✅ Done — Updated: ${updated}  Skipped (404): ${skipped}  Failed: ${failed}`)
}

run().catch(err => { console.error(err); process.exit(1) })
