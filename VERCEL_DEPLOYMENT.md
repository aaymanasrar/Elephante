# Vercel Deployment Guide — AI Features

## Environment Variables Required for Vercel

Add these environment variables to your Vercel project via the **Settings → Environment Variables** dashboard:

### Core Configuration
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (starts with `https://`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)

### AI Model Server
- `NEXT_PUBLIC_AI_MODEL_URL` — Custom Render AI server URL
  - Default: `https://elephante-ai-server.onrender.com`
  - Scope: **Public** (used by client & server)

### HuggingFace (ALLaM-7B for Arabic Fashion Analysis)
- `HUGGINGFACE_API_KEY` — HuggingFace API token from https://huggingface.co/settings/tokens
  - Scope: **Server-only** (never expose to client)

### AI Provider Keys (Choose at least one)
All keys can be configured with **Server-only** scope:

| Provider | Environment Variable | Free Tier | Link |
|----------|----------------------|-----------|------|
| Google AI Studio | `GOOGLE_AI_STUDIO_KEY` | Yes | https://aistudio.google.com |
| Groq | `GROQ_API_KEY` | Yes | https://console.groq.com |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | No | https://console.anthropic.com |
| OpenAI | `OPENAI_API_KEY` | No | https://platform.openai.com/api-keys |
| Gemini | `GEMINI_API_KEY` | Yes | https://aistudio.google.com |
| Cerebras | `CEREBRAS_API_KEY` | Yes | https://www.cerebras.ai |
| NVIDIA | `NVIDIA_API_KEY` | Yes | https://build.nvidia.com |
| OpenRouter | `OPENROUTER_API_KEY` | Yes | https://openrouter.ai |
| Mistral | `MISTRAL_API_KEY` | No | https://console.mistral.ai |
| DeepSeek | `DEEPSEEK_API_KEY` | No | https://platform.deepseek.com |

### Pollinations (Image Generation - Optional)
- `POLLINATIONS_TOKEN` — Token from https://auth.pollinations.ai (optional, for higher rate limits)

### Factory Token (CI/CD - Optional)
- `FACTORY_TOKEN` — For automated code review via GitHub Actions

---

## Setup Steps

### 1. Open Vercel Dashboard
Go to your project at https://vercel.com/elephante-app

### 2. Navigate to Settings → Environment Variables

### 3. Add Variables
For each variable, click **Add New**:
- **Name** — Exact variable name from list above
- **Value** — Your API key/token
- **Environments** — Select `Production`, `Preview`, `Development` as needed
  - **Public values** (starting with `NEXT_PUBLIC_`): All environments
  - **Server-only values**: `Production` + `Preview`

### 4. Redeploy
After adding variables:
```bash
vercel --prod
```

Or redeploy via GitHub:
1. Push changes to `main` branch
2. Vercel will automatically redeploy with new env vars

---

## New Features Enabled

✅ **ALLaM-7B Arabic Model** — Cultural fashion tag generation
- Improves Arabic outfit analysis
- Detects cultural context (Najdi Formal, Hijazi Summer, etc.)

✅ **Stylist's Vision** — AI-generated outfit visualizations
- Uses Pollinations API (`https://image.pollinations.ai/prompt/...`)
- Displays beautiful outfit concepts based on AI prompts

✅ **Cultural Tags** — Contextual fashion styling
- Shows fashion tradition, formality level, cultural origin
- Bilingual support (English & Arabic)

---

## Testing Locally

Before deploying, test locally with `.env.local`:

```bash
NEXT_PUBLIC_AI_MODEL_URL=https://elephante-ai-server.onrender.com
HUGGINGFACE_API_KEY=your_hf_token
GOOGLE_AI_STUDIO_KEY=your_google_key
# ... other keys
```

Then run:
```bash
npm run dev
```

Upload a clothing photo to test:
1. Go to http://localhost:3000/feed
2. Click camera icon
3. Upload any clothing image
4. Click "Analyze Style" button
5. Wait for cultural tags & Stylist's Vision to load

---

## Troubleshooting

### "NEXT_PUBLIC_AI_MODEL_URL not configured"
- Add `NEXT_PUBLIC_AI_MODEL_URL` to Vercel environment variables
- Must be `Public` scope for browser access
- Restart deployment after adding

### HuggingFace inference fails
- Check `HUGGINGFACE_API_KEY` is valid and has inference permissions
- Model: `humain-ai/ALLaM-7B-Instruct-preview`
- Fallback to Google AI Studio if HF is unavailable (automatic)

### Stylist's Vision image not loading
- Pollinations API occasionally throttles requests
- Images timeout after 30 seconds automatically
- Fallback gracefully with error UI

### "All vision providers failed"
- Ensure at least ONE AI provider key is configured
- Check quota on your API keys
- Verify keys are correct in Vercel → Settings → Environment Variables

---

## Production Best Practices

1. **Rotate API Keys Regularly** — Especially for production
2. **Use Vercel Secrets** — Don't commit keys to git
3. **Monitor Costs** — Some providers charge by API calls
4. **Set Rate Limits** — `/api/wardrobe/upload` already has 10 req/min limit
5. **Backup Keys** — Keep spare keys for each provider in case of outages

---

## Reference Documentation

- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [AI Server Endpoint](/analyze) — Call the custom Render AI server
- [ALLaM Model](https://huggingface.co/humain-ai/ALLaM-7B-Instruct-preview)
- [Pollinations API](https://pollinations.ai)
