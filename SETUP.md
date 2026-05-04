# Elephante Setup Instructions

## Quick Start

Your Elephante AI stylist is already running on **http://localhost:3000**

All API keys are configured in `.env.local`. The only remaining step is to set up the database.

---

## Step 1: Run the Supabase Schema

1. Go to your Supabase dashboard: https://rqvjgcrlazkppplvhevg.supabase.co
2. Open the **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `supabase-schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

This will create all required tables:
- `profiles` - User profiles with style preferences
- `excel_outfits` - Main outfit archive (AI-generated + imported)
- `saved_outfits` - User saved outfits
- `scraped_products` - Product search cache (24h TTL)
- `closet_items` - User wardrobe uploads

You should see "Success. No rows returned" for each statement.

---

## Step 2: Create Storage Bucket (for wardrobe uploads)

In Supabase Dashboard:
1. Go to **Storage** (left sidebar)
2. Click **New bucket**
3. Name it: `wardrobe`
4. Check **Public bucket**
5. Click **Create bucket**

---

## Step 3: Test the AI Stylist

1. **Register a new account**: http://localhost:3000/register
2. **Complete onboarding**: You'll be guided through:
   - Gender selection
   - Skin tone
   - Color palette preferences
   - Occasions you dress for
3. **Generate outfits**: Go to http://localhost:3000/ai-stylist
   - Select an occasion
   - Choose a mood/vibe
   - Pick a season
   - Click **Generate Outfits**

The AI will create 3 personalized outfits with:
- Real product links from ASOS, H&M, and Uniqlo
- Generated outfit visualization images
- Styling tips tailored to your body type and skin tone

---

## Features

- **Multi-provider AI fallback**: If one AI provider fails, it automatically tries the next
- **Product search**: Real-time product lookup from retailer APIs (cached for 24h)
- **Image generation**: Outfit visualizations via Higgsfield (FLUX Pro), DALL-E 3, or Pollinations
- **Bilingual support**: English and Arabic interface
- **Row Level Security**: Users can only access their own data

---

## Troubleshooting

**"Table does not exist" errors**: Run the Supabase schema (Step 1)

**AI generation fails**: Check that at least one API key in `.env.local` is valid

**Product search returns nothing**: This is normal for niche queries. The search is case-insensitive and tries multiple retailers.

**Port 3000 in use**: The dev server will automatically use port 3001 instead

---

## Moving to Disk D

If you want to move the project to disk D:

1. Stop the dev server (Ctrl+C in terminal)
2. Copy the entire `C:\Users\HP\elephante` folder to `D:\elephante`
3. Open terminal in `D:\elephante`
4. Run `npm install` (to ensure paths are correct)
5. Run `npm run dev`

No code changes needed - all paths are relative.
