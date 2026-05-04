// scripts/migrate-excel-images.mjs
// Run: node scripts/migrate-excel-images.mjs
//
// Security note:
// This script expects NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// to come from your environment. Do not hardcode secrets in this repository.

import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'Outfits'
const FOLDER = 'Excel'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add both variables to your environment before running this migration.'
  )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function run() {
  const { data: rows, error } = await supabase
    .from('excel_outfits')
    .select('id, source_id, image_url')
    .not('image_url', 'is', null)
    .not('image_url', 'like', `%${SUPABASE_URL}%`)

  if (error) {
    console.error('Fetch error:', error)
    process.exit(1)
  }

  console.log(`Found ${rows?.length || 0} rows to migrate`)

  for (const row of rows || []) {
    if (!row.image_url || !row.source_id) continue

    const ext = row.image_url.includes('.png') ? 'png' : 'jpg'
    const filename = `${row.source_id}.${ext}`
    const path = `${FOLDER}/${filename}`

    try {
      console.log(`Downloading ${row.source_id} - ${row.image_url}`)
      const response = await fetch(row.image_url, {
        headers: { Referer: '' },
      })

      if (!response.ok) {
        console.warn(`  x HTTP ${response.status} - skipping`)
        continue
      }

      const bytes = new Uint8Array(await response.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, {
          contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
          upsert: true,
        })

      if (uploadError) {
        console.warn(`  x Upload failed: ${uploadError.message}`)
        continue
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
      const { error: updateError } = await supabase
        .from('excel_outfits')
        .update({ image_url: publicUrl })
        .eq('id', row.id)

      if (updateError) {
        console.warn(`  x DB update failed: ${updateError.message}`)
      } else {
        console.log(`  ok Done - ${publicUrl}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.warn(`  x Error for ${row.source_id}:`, message)
    }
  }

  console.log('\nMigration complete.')
  console.log('Run this SQL to verify:')
  console.log('SELECT source_id, LEFT(image_url, 80) FROM excel_outfits ORDER BY source_id;')
}

run()
