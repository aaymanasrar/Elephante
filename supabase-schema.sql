-- Elephante Database Schema
-- Run this in your Supabase SQL Editor to create all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- Stores user profile information for personalized styling
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  password_hash TEXT,
  credit_balance INTEGER NOT NULL DEFAULT 0,
  full_name TEXT,
  username TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'non-binary')),
  skin_tone TEXT,
  skin_undertone TEXT CHECK (skin_undertone IN ('cool', 'warm', 'neutral')),
  body_shape TEXT,
  height_category TEXT,
  preferred_palette TEXT,
  selected_occasions TEXT[],
  style_preference TEXT,
  style_bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
ON profiles (LOWER(email))
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
ON profiles (LOWER(username))
WHERE username IS NOT NULL;

-- ============================================================================
-- OUTFITS TABLE (Legacy - for user-created outfits)
-- ============================================================================
CREATE TABLE IF NOT EXISTS outfits (
  id SERIAL PRIMARY KEY,
  outfit_code TEXT,
  style_category TEXT,
  color_scheme TEXT,
  top_wear TEXT,
  bottom_wear TEXT,
  shoes TEXT,
  accessories TEXT,
  outerwear TEXT,
  occasions TEXT,
  outfit_details TEXT,
  material_top TEXT,
  material_bottom TEXT,
  material_shoes TEXT,
  material_notes TEXT,
  hex_colors TEXT[],
  gender TEXT DEFAULT 'male',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXCEL_OUTFITS TABLE (Main outfit archive - imported from Excel + AI generated)
-- ============================================================================
CREATE TABLE IF NOT EXISTS excel_outfits (
  id SERIAL PRIMARY KEY,
  source_id TEXT UNIQUE,
  style_category TEXT,
  color_scheme TEXT,
  colors TEXT,
  top_wear TEXT,
  bottom_wear TEXT,
  shoes TEXT,
  accessories TEXT,
  outerwear TEXT,
  occasions TEXT,
  when_to_wear TEXT,
  outfit_details TEXT,
  material_top TEXT,
  material_bottom TEXT,
  material_shoes TEXT,
  material_notes TEXT,
  hex_colors TEXT[],
  gender TEXT DEFAULT 'male',
  image_url TEXT,
  is_alternative BOOLEAN DEFAULT FALSE,
  primary_outfit_ref INTEGER REFERENCES excel_outfits(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SAVED_OUTFITS TABLE (User saved outfits)
-- ============================================================================
CREATE TABLE IF NOT EXISTS saved_outfits (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  outfit_ref TEXT NOT NULL,
  outfit_id TEXT,
  source TEXT CHECK (source IN ('excel', 'ai_stylist', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, outfit_ref)
);

-- ============================================================================
-- SCRAPED_PRODUCTS TABLE (Product search cache - 24h TTL)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scraped_products (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  gender TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  price TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  category TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_scraped_products_query_gender
ON scraped_products(query, gender, scraped_at);

-- ============================================================================
-- CLOSET_ITEMS TABLE (User wardrobe uploads)
-- ============================================================================
CREATE TABLE IF NOT EXISTS closet_items (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN ('tops', 'bottoms', 'shoes', 'outerwear', 'accessories')),
  item_type TEXT,
  item_name TEXT,
  brand TEXT,
  color TEXT,
  occasion TEXT,
  style_query TEXT,
  image_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SAVED_PIECES TABLE (Legacy category archive support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS saved_pieces (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  outfit_id INTEGER REFERENCES outfits(id) ON DELETE SET NULL,
  piece_name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_excel_outfits_updated_at ON excel_outfits;
CREATE TRIGGER update_excel_outfits_updated_at
  BEFORE UPDATE ON excel_outfits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE closet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_pieces ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only view/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Saved outfits: Users can only manage their own saved outfits
CREATE POLICY "Users can view own saved outfits" ON saved_outfits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved outfits" ON saved_outfits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved outfits" ON saved_outfits
  FOR DELETE USING (auth.uid() = user_id);

-- Closet items: Users can only manage their own items
CREATE POLICY "Users can view own closet items" ON closet_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own closet items" ON closet_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own closet items" ON closet_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own closet items" ON closet_items
  FOR DELETE USING (auth.uid() = user_id);

-- Saved pieces: Users can only manage their own saved pieces
CREATE POLICY "Users can view own saved pieces" ON saved_pieces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved pieces" ON saved_pieces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved pieces" ON saved_pieces
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- CREDIT BALANCE + TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0),
  balance_after integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('debit', 'credit', 'refund', 'adjustment')),
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit transactions"
  ON credit_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION deduct_image_credit(
  request_user_id uuid,
  amount integer,
  description text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE profiles
  SET credit_balance = credit_balance - amount
  WHERE id = request_user_id AND credit_balance >= amount
  RETURNING credit_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_credit';
  END IF;

  INSERT INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    transaction_type,
    description,
    metadata
  ) VALUES (
    request_user_id,
    -amount,
    new_balance,
    'debit',
    description,
    metadata
  );

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION refund_image_credit(
  request_user_id uuid,
  amount integer,
  description text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE profiles
  SET credit_balance = credit_balance + amount
  WHERE id = request_user_id
  RETURNING credit_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'invalid_user';
  END IF;

  INSERT INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    transaction_type,
    description,
    metadata
  ) VALUES (
    request_user_id,
    amount,
    new_balance,
    'refund',
    description,
    metadata
  );

  RETURN new_balance;
END;
$$;

-- ============================================================================
-- STORAGE BUCKETS (for wardrobe uploads)
-- ============================================================================
-- Note: Run this separately in Supabase Dashboard > Storage or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('wardrobe', 'wardrobe', true);

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================
-- Uncomment to add sample outfits for testing
-- INSERT INTO excel_outfits (source_id, style_category, color_scheme, top_wear, bottom_wear, shoes, gender) VALUES
--   ('sample_1', 'Smart Casual', 'Navy + White + Tan', 'White Oxford shirt', 'Navy chinos', 'Brown loafers', 'male'),
--   ('sample_2', 'Minimal', 'Black + White', 'Black crew neck tee', 'Black slim jeans', 'White sneakers', 'male'),
--   ('sample_3', 'Quiet Luxury', 'Camel + Cream + Charcoal', 'Cashmere sweater', 'Wide-leg trousers', 'Leather loafers', 'female');
