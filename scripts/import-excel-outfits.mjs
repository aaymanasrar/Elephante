import { createClient } from '@supabase/supabase-js'
import pkg from 'xlsx'
const { readFile: XLSXReadFile, utils: XLSXUtils } = pkg

const SUPABASE_URL = 'https://rqvjgcrlazkppplvhevg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdmpnY3JsYXprcHBwbHZoZXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTk0MTYsImV4cCI6MjA4NjM3NTQxNn0.ViPZTpTRinaubSsPbNvX9DwIZLO-8YV381NGONWZKFE'
const EXCEL_PATH   = 'C:/Users/HP/Desktop/elephante_formal_outfits (1).xlsx'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Read workbook ────────────────────────────────────────────────────────────
const wb = XLSXReadFile(EXCEL_PATH)

function sheetToRows(sheetName) {
  const ws = wb.Sheets[sheetName]
  if (!ws) { console.error(`Sheet "${sheetName}" not found`); return [] }
  return XLSXUtils.sheet_to_json(ws, { header: 1, defval: '' })
}

// ─── Parse "All Outfits" ──────────────────────────────────────────────────────
const allRows = sheetToRows('All Outfits')

// Find the header row: the row where first non-empty cell looks like "Outfit ID"
let headerIdx = -1
for (let i = 0; i < allRows.length; i++) {
  const first = String(allRows[i][0] || '').trim()
  if (first.toLowerCase().includes('outfit id') || first.toLowerCase() === 'outfit id') {
    headerIdx = i
    break
  }
}
if (headerIdx === -1) {
  // Fallback: row 1 is usually the header (row 0 is merged title)
  headerIdx = 1
}

const headers = allRows[headerIdx].map(h => String(h).trim())
console.log('Headers found at row', headerIdx, ':', headers)

const dataRows = allRows.slice(headerIdx + 1).filter(r => r[0] && String(r[0]).trim())

function colIdx(name) {
  const idx = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
  return idx === -1 ? null : idx
}

const COL = {
  source_id:    colIdx('outfit id'),
  gender:       colIdx('gender'),
  style:        colIdx('style'),
  skin_tones:   colIdx('skin tone'),
  body_types:   colIdx('body type'),
  heights:      colIdx('height'),
  color_scheme: colIdx('color scheme'),
  top_wear:     colIdx('top wear'),
  bottom_wear:  colIdx('bottom wear'),
  shoes:        colIdx('shoes'),
  accessories:  colIdx('accessories'),
  outerwear:    colIdx('layer') ?? colIdx('outerwear'),
  color1:       colIdx('color 1') ?? colIdx('colour 1'),
  color2:       colIdx('color 2') ?? colIdx('colour 2'),
  color3:       colIdx('color 3') ?? colIdx('colour 3'),
  details:      colIdx('why it works') ?? colIdx('detail'),
  occasions:    colIdx('occasion'),
}
console.log('Column map:', COL)

// ─── Parse "Seasonal Guide" ───────────────────────────────────────────────────
const seasonRows = sheetToRows('Seasonal Guide')
const whenToWear = {}   // outfit_id → when_to_wear string

if (seasonRows.length > 0) {
  // Find header row in seasonal guide
  let sHeaderIdx = -1
  for (let i = 0; i < seasonRows.length; i++) {
    const first = String(seasonRows[i][0] || '').trim().toLowerCase()
    if (first.includes('outfit') || first.includes('season') || first.includes('id')) {
      sHeaderIdx = i
      break
    }
  }
  if (sHeaderIdx === -1) sHeaderIdx = 1

  const sHeaders = seasonRows[sHeaderIdx].map(h => String(h).trim())
  console.log('Seasonal Guide headers:', sHeaders)

  const sIdCol    = sHeaders.findIndex(h => h.toLowerCase().includes('outfit') || h.toLowerCase().includes('id'))
  const sWhenCol  = sHeaders.findIndex(h => h.toLowerCase().includes('season') || h.toLowerCase().includes('when') || h.toLowerCase().includes('wear'))

  for (let i = sHeaderIdx + 1; i < seasonRows.length; i++) {
    const row = seasonRows[i]
    const id   = String(row[sIdCol] ?? '').trim()
    const when = String(row[sWhenCol] ?? '').trim()
    if (id && when) whenToWear[id] = when
  }
  console.log('Seasonal data:', Object.keys(whenToWear).length, 'entries')
}

// ─── Build upsert payloads ────────────────────────────────────────────────────
function cell(row, col) {
  if (col === null || col === undefined) return ''
  const v = row[col]
  return v === null || v === undefined ? '' : String(v).trim()
}

const upserts = dataRows.map(row => {
  const sourceId = cell(row, COL.source_id)

  const hexColors = [
    cell(row, COL.color1),
    cell(row, COL.color2),
    cell(row, COL.color3),
  ].filter(Boolean)

  const occasions = cell(row, COL.occasions)

  return {
    source_id:      sourceId,
    gender:         cell(row, COL.gender).toLowerCase(),
    style_category: cell(row, COL.style),
    color_scheme:   cell(row, COL.color_scheme),
    top_wear:       cell(row, COL.top_wear),
    bottom_wear:    cell(row, COL.bottom_wear),
    shoes:          cell(row, COL.shoes),
    accessories:    cell(row, COL.accessories),
    outerwear:      cell(row, COL.outerwear),
    hex_colors:     hexColors.length ? hexColors : null,
    outfit_details: cell(row, COL.details),
    occasions:      occasions || null,
    when_to_wear:   whenToWear[sourceId] || null,
  }
}).filter(r => r.source_id)

console.log(`\nParsed ${upserts.length} outfits`)
console.log('Sample:', JSON.stringify(upserts[0], null, 2))

// ─── Upsert into excel_outfits ────────────────────────────────────────────────
async function run() {
  console.log('\nUpserting into excel_outfits...')

  // Do in batches of 10
  const batchSize = 10
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < upserts.length; i += batchSize) {
    const batch = upserts.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('excel_outfits')
      .upsert(batch, { onConflict: 'source_id', ignoreDuplicates: false })
      .select('source_id')

    if (error) {
      console.error(`  Batch ${i / batchSize + 1} error:`, error.message)
      errorCount += batch.length
    } else {
      const ids = (data || []).map(r => r.source_id).join(', ')
      console.log(`  Batch ${i / batchSize + 1} OK: ${ids}`)
      successCount += batch.length
    }
  }

  console.log(`\nDone! ${successCount} upserted, ${errorCount} errors`)
}

run().catch(console.error)
