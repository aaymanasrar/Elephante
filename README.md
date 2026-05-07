# Elephante

Elephante is a Next.js styling app that helps users discover outfits, save looks, and use AI-assisted wardrobe flows for search, inspiration, and closet organization.

## Features

- AI-assisted styling flows and outfit generation
- Feed, closet, outfit detail, login, register, and onboarding routes
- Supabase-backed auth, profiles, saved outfits, and wardrobe data
- Upload-first wardrobe intake with editable AI-generated tags
- Reusable UI primitives such as particle background, logo, and loading states

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Framer Motion
- Supabase
- OpenAI-compatible AI integrations

## Environment Variables

Create `.env.local` from `.env.example`.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Common AI / server-side keys used by routes and scripts:

- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SKYWORK_API_KEY`
- `POLLINATIONS_TOKEN`
- `MAGNIFIC_API_KEY`
- `MAGNIFIC_WEBHOOK_URL`
- `MAGNIFIC_MYSTIC_MODEL`
- `MAGNIFIC_MYSTIC_RESOLUTION`
- `MAGNIFIC_MYSTIC_ASPECT_RATIO`
- `MAGNIFIC_MYSTIC_CREATIVE_DETAILING`
- `MAGNIFIC_MYSTIC_ENGINE`
- `MAGNIFIC_MYSTIC_TIMEOUT_MS`
- `EDENAI_API_KEY`
- `EDENAI_IMAGE_MODEL`
- `EDENAI_IMAGE_RESOLUTION`
- `HIGGSFIELD_API_KEY_ID`
- `HIGGSFIELD_API_KEY_SECRET`

Optional provider keys supported by the AI service layer:

- `ANTHROPIC_API_KEY`
- `GOOGLE_AI_STUDIO_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `CEREBRAS_API_KEY`
- `NVIDIA_API_KEY`
- `LLM7_API_KEY`
- `OPENROUTER_API_KEY`
- `MISTRAL_API_KEY`
- `DEEPSEEK_API_KEY`
- `KIMI_API_KEY`
- `PERPLEXITY_API_KEY`
- `PERPLEXITY_MODEL`
- `PERPLEXITY_SEARCH_TYPE`
- `OLLAMA_API_KEY`
- `OLLAMA_MODEL`

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Development Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Folder Structure

```text
app/          App Router pages and API routes
components/   Reusable UI components
hooks/        Custom React hooks
data/         Static app data and translations
lib/          Pure utilities and helper functions
services/     API and service integrations
types/        Shared TypeScript types
scripts/      Local maintenance scripts
public/       Static assets
```

## Deployment

Deploy on Vercel or another Next.js-compatible platform. Make sure all required environment variables are configured in the target environment before building.

## Security Note

`scripts/migrate-excel-images.mjs` now reads `SUPABASE_SERVICE_ROLE_KEY` from the environment. Do not commit service-role keys or other secrets into the repository.
