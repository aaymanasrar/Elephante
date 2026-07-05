# Bugs Found in Elephante — Jules Fix List

## 🐛 Bug #1: Unsafe Error Message Access in `app/api/product-search/route.ts`
**File**: [app/api/product-search/route.ts](app/api/product-search/route.ts#L25)
**Severity**: Medium
**Issue**: 
```javascript
catch (err: any) {
  return NextResponse.json({ error: err.message }, { status: 500 })
}
```
If `err` is not an Error object (e.g., a string or null), `err.message` will be `undefined`, exposing incomplete error info to the client.

**Fix**: Safely extract error message:
```javascript
catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  return NextResponse.json({ error: message || 'Product search failed' }, { status: 500 })
}
```

---

## 🐛 Bug #2: Silent JSON Parse Failures in `services/feedSearchApi.ts` & `services/outfitService.ts`
**Files**: 
- [services/feedSearchApi.ts](services/feedSearchApi.ts#L64)
- [services/outfitService.ts](services/outfitService.ts#L42)

**Severity**: Medium
**Issue**: 
```javascript
const data = await response.json().catch(() => ({}))
if (!response.ok) {
  throw new Error(typeof data?.error === 'string' ? data.error : `outfit-search failed (${response.status})`)
}
```
If JSON parsing fails, `data` is an empty object, and the error message becomes generic. User won't know if the API failed or returned invalid JSON.

**Fix**: Log JSON parse errors and provide better fallback messages:
```javascript
let data = {}
try {
  data = await response.json()
} catch (parseErr) {
  console.warn('Failed to parse response JSON:', parseErr)
  data = { error: 'Invalid server response' }
}
if (!response.ok) {
  throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${response.status})`)
}
```

---

## 🐛 Bug #3: Missing Error Context in `services/productSearch.ts`
**File**: [services/productSearch.ts](services/productSearch.ts#L56-L75)
**Severity**: Low
**Issue**: 
Multiple `.catch() { return [] }` swallow all errors silently. Network errors, parse errors, and timeouts all fail silently without logging.

**Fix**: Log errors for debugging:
```javascript
catch (err) {
  console.error('H&M fetch failed:', err)
  return []
}
```

---

## 🐛 Bug #4: Potential Race Condition in `hooks/useWardrobeAttachment.ts`
**File**: [hooks/useWardrobeAttachment.ts](hooks/useWardrobeAttachment.ts#L45-L80)
**Severity**: Low
**Issue**: 
If user rapidly selects multiple files, `attachFile()` is called multiple times. The second call's `URL.revokeObjectURL()` might try to revoke a URL that's still in use by the first upload.

**Fix**: Add a check to prevent overlapping uploads:
```javascript
const attachFile = async (file: File | null | undefined) => {
  if (!file || attachment?.uploading) return  // ← Prevent overlapping uploads
  
  if (attachment?.preview?.startsWith('blob:')) URL.revokeObjectURL(attachment.preview)
  // ... rest of function
}
```

---

## 🐛 Bug #5: Incomplete Error Logging in `app/api/user/balance/route.ts`
**File**: [app/api/user/balance/route.ts](app/api/user/balance/route.ts#L5-L15)
**Severity**: Low
**Issue**: 
`requireEnv()` might throw with sensitive internal details. Should catch and provide generic error message.

**Fix**: 
```javascript
export async function GET(request: NextRequest) {
  try {
    let supabaseUrl: string, supabaseAnonKey: string
    try {
      supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'the user balance route')
      supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'the user balance route')
    } catch (envErr) {
      console.error('Environment config error:', envErr)
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }
    // ... rest of function
```

---

## Summary
- **2 Medium severity bugs** (error handling in API routes)
- **3 Low severity bugs** (race conditions, missing logs, incomplete error context)
- **All bugs are fixable** and improve reliability + debuggability

Jules should prioritize bugs #1 and #2, then fix #3–#5.

---

## ✅ Status Update (2026-07-02)
All 5 bugs above are FIXED. Additionally fixed (build-breaking):

## 🐛 Bug #6: Module-scope env validation crashed `next build` — FIXED
- `lib/supabase.ts` threw on import when env vars absent (imported in 19 files) → now a lazy Proxy client
- `app/layout.tsx` → `validateRequiredEnv` in `lib/env.ts` now warns during build phase, still throws at runtime
- `app/api/outfit-image-fill/route.ts`, `app/api/wear-log/route.ts`, `services/productSearch.ts` created Supabase clients at module scope → now lazy `getSupabase()`

Result: `tsc --noEmit` ✓, `eslint` 0 errors ✓, `next build` ✓ (with or without env vars).
