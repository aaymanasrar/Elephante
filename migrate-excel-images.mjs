// migrate-excel-images.mjs
// Run: node migrate-excel-images.mjs
//
// What it does:
// 1. Reads all excel_outfits rows with external image URLs
// 2. Downloads each image
// 3. Uploads to Supabase storage under /Outfits/Excel/
// 4. Updates image_url in excel_outfits to the new storage URL

import { createClient } from '@supabase/supabase-js'

// ─── CONFIG — fill these in ───────────────────────────────────────────────────
const SUPABASE_URL        = 'https://rqvjgcrlazkppplvhevg.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdmpnY3JsYXprcHBwbHZoZXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTk0MTYsImV4cCI6MjA4NjM3NTQxNn0.ViPZTpTRinaubSsPbNvX9DwIZLO-8YV381NGONWZKFE'   // Settings → API → service_role (secret)
const BUCKET               = 'Outfits'
const FOLDER               = 'Excel'
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function run() {
  // 1. Fetch all rows that still have external URLs
  const { data: rows, error } = await supabase
    .from('excel_outfits')
    .select('id, source_id, image_url')
    .not('image_url', 'is', null)
    .not('image_url', 'like', `%${SUPABASE_URL}%`)   // skip already-migrated rows

  if (error) { console.error('Fetch error:', error); process.exit(1) }
  console.log(`Found ${rows.length} rows to migrate`)

  for (const row of rows) {
    const ext      = row.image_url.includes('.png') ? 'png' : 'jpg'
    const filename = `${row.source_id}.${ext}`
    const path     = `${FOLDER}/${filename}`

    try {
      // 2. Download the image
      console.log(`Downloading ${row.source_id} — ${row.image_url}`)
      const res = await fetch(row.image_url, {
        headers: { 'Referer': '' },   // no-referrer to bypass hotlink protection
      })

      if (!res.ok) {
        console.warn(`  ✗ HTTP ${res.status} — skipping`)
        continue
      }

      const buffer = await res.arrayBuffer()
      const bytes  = new Uint8Array(buffer)

      // 3. Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, {
          contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
          upsert: true,
        })

      if (uploadError) {
        console.warn(`  ✗ Upload failed: ${uploadError.message}`)
        continue
      }

      // 4. Build public URL and update the row
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`

      const { error: updateError } = await supabase
        .from('excel_outfits')
        .update({ image_url: publicUrl })
        .eq('id', row.id)

      if (updateError) {
        console.warn(`  ✗ DB update failed: ${updateError.message}`)
      } else {
        console.log(`  ✓ Done — ${publicUrl}`)
      }

    } catch (err) {
      console.warn(`  ✗ Error for ${row.source_id}:`, err.message)
    }
  }

  console.log('\nMigration complete.')
  console.log('Run this SQL to verify:')
  console.log(`SELECT source_id, LEFT(image_url, 80) FROM excel_outfits ORDER BY source_id;`)
}

run()
