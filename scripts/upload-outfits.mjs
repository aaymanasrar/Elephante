import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const SUPABASE_URL = 'https://rqvjgcrlazkppplvhevg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdmpnY3JsYXprcHBwbHZoZXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTk0MTYsImV4cCI6MjA4NjM3NTQxNn0.ViPZTpTRinaubSsPbNvX9DwIZLO-8YV381NGONWZKFE'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const EF_ROOT = 'C:/Users/HP/Desktop/EF'
const BUCKET = 'Outfits'

// Map folder prefix → style + occasion + gender
const CATEGORY_MAP = {
  FB:  { style: 'Business Casual', occasion: 'Business', gender: 'female' },
  FF:  { style: 'Formal',          occasion: 'Formal',   gender: 'female' },
  FSC: { style: 'Smart Casual',    occasion: 'Casual',   gender: 'female' },
  MBC: { style: 'Business Casual', occasion: 'Business', gender: 'male'   },
  MF:  { style: 'Formal',          occasion: 'Formal',   gender: 'male'   },
  MSC: { style: 'Smart Casual',    occasion: 'Casual',   gender: 'male'   },
}

// Derive category prefix from outfit code (e.g. "FBC01" → "FB", "MSC06" → "MSC")
function getCategoryKey(code) {
  for (const key of Object.keys(CATEGORY_MAP)) {
    if (code.startsWith(key)) return key
  }
  return null
}

async function run() {
  const categories = readdirSync(EF_ROOT).filter(d => statSync(join(EF_ROOT, d)).isDirectory())

  for (const cat of categories) {
    const catKey = getCategoryKey(cat)
    if (!catKey) { console.log(`Skipping unknown category: ${cat}`); continue }
    const meta = CATEGORY_MAP[catKey]

    const outfitDirs = readdirSync(join(EF_ROOT, cat))
      .filter(d => statSync(join(EF_ROOT, cat, d)).isDirectory())

    for (const outfitCode of outfitDirs) {
      const outfitDir = join(EF_ROOT, cat, outfitCode)
      const files = readdirSync(outfitDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      if (files.length === 0) { console.log(`No image in ${outfitDir}`); continue }

      const imgFile = files[0]
      const imgPath = join(outfitDir, imgFile)
      const storagePath = `EF/${cat}/${outfitCode}${extname(imgFile)}`

      console.log(`Uploading ${outfitCode}...`)

      // Upload image
      const fileBuffer = readFileSync(imgPath)
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: imgFile.endsWith('.png') ? 'image/png' : 'image/jpeg',
          upsert: true,
        })

      if (uploadError) {
        console.error(`  Upload error for ${outfitCode}:`, uploadError.message)
        continue
      }

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

      // Insert into outfits table
      const { error: dbError } = await supabase.from('outfits').insert({
        style: meta.style,
        occasion: meta.occasion,
        outfit_code: outfitCode,
        image_url: publicUrl,
        colors: [],
        pieces: [],
        skin_tones: [],
        aesthetic: `${meta.gender === 'female' ? 'Female' : 'Male'} ${meta.style}`,
        top: '',
      })

      if (dbError) {
        console.error(`  DB insert error for ${outfitCode}:`, dbError.message)
      } else {
        console.log(`  ✓ ${outfitCode} → ${publicUrl}`)
      }
    }
  }

  console.log('\nDone!')
}

run().catch(console.error)
