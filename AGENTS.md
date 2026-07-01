# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Elephante is a fashion AI personal stylist web app — users describe occasions or upload outfit photos, and the AI curates, rates, and generates outfit suggestions. It supports Arabic and English.

## Development Commands

```bash
npm run dev        # Start local dev server (Turbopack)
npm run build      # Production build
npm run lint       # ESLint
vercel --prod      # Deploy to production (elephante.app)
```

## Environment

All secrets live in `.env.local` at the **project root** (not inside `app/`). Required vars:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client-side Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only (API routes)
- AI provider keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_STUDIO_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `CEREBRAS_API_KEY`, `NVIDIA_API_KEY`, `KIMI_API_KEY`
- `NEXT_PUBLIC_AI_MODEL_URL` — custom Render AI server (`https://elephante-ai-server.onrender.com`)

## Architecture

### Three-tier Backend
1. **Vercel serverless** — Next.js API routes handle all business logic
2. **Supabase** — PostgreSQL (profiles, outfits, closet_items, saved_items), Auth (JWT), Storage (`wardrobe` bucket for clothing photos)
3. **Render** — Custom AI model server called by `services/aiProviders.ts`

### AI Provider Fallback Chain (`services/aiProviders.ts`)
`analyzeImageWithFallback()` fans out across 10+ providers in priority order. Never call a single provider directly — always go through this service. The `extractJSON()` utility parses AI responses that may contain markdown fences.

### Auth Flow
- Login: client → `/api/auth/login` → looks up email by username in `profiles` table → Supabase `signInWithPassword` → returns `{ session }` → client calls `supabase.auth.setSession()`
- Register: client → `/api/auth/register` → checks availability → `supabase.auth.signUp` → upserts profile row
- Shared utilities in `app/api/auth/_utils.ts`: `getAuthClients()`, `findProfileByField()`, `publicSession()`

### Feed & Search (`app/feed/`)
- `useFeedSearch` — handles natural language vs keyword query routing, AI context, chat history
- `useElephanteData` — bootstraps user profile + all outfits on mount
- `useWardrobeAttachment` — manages clothing photo upload state; has `error?: string` field (never set to `null` on failure — show the error instead)
- `SearchFooter` — bottom bar with camera button (triggers wardrobe upload) and search input
- `FeedHeader` — centred brand logo that animates to top when searching

### Internationalisation
`LocaleProvider` in `app/layout.tsx` wraps the whole app. Use `useLocale()` → `{ lang, isAr, setLang }`. The `LanguageToggle` component reads `usePathname()` and returns `null` on `/feed` — it only appears on login/register/settings pages.

### Viewport / Mobile
`app/layout.tsx` exports `viewport` with `maximumScale: 1` to prevent iOS auto-zoom on input focus.

## Key Patterns

- **RLS**: All Supabase tables use Row Level Security. When adding tables, always `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and create per-user policies.
- **Rate limiting**: Every API route calls `rateLimit(request, { limit, window })` at the top before any logic.
- **Error visibility**: API errors must surface to the user — never silently swallow them and clear state.
- **Image types**: The wardrobe upload accepts JPEG, PNG, WebP, HEIC, HEIF. Use `inferImageType()` which falls back to filename extension when `file.type` is empty (common on mobile).

## Supabase Project

Active project: `rqvjgcrlazkppplvhevg` (Elephante, `https://rqvjgcrlazkppplvhevg.supabase.co`). The older project `noookqnolfghhzvrhbib` is INACTIVE — do not use it.

## Skills Available

Active Codex skills in `.Codex/skills/`: `ui-ux-pro-max`, `frontend-design`, `code-reviewer`, `Codex-seo`, `excalidraw-diagram`, `algorithmic-art`, `canvas-design`, `brand-guidelines`, `notebooklm`, `skill-creator`. Other skills are parked in `.Codex/skills-later/` for future use.
