-- Add avatar_url column to profiles table for custom try-on avatars
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
