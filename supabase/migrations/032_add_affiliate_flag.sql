-- Migration: Add affiliate flag to user_profiles
-- This allows marking users as affiliates who can then manage their own referral codes

-- Add is_affiliate flag to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT FALSE;

-- Create index for quick affiliate lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_affiliate ON user_profiles(is_affiliate) WHERE is_affiliate = TRUE;

-- Update RLS policy for creator_codes to allow affiliates to manage their own codes
-- First drop existing policies if they exist
DROP POLICY IF EXISTS "Affiliates can view their own codes" ON creator_codes;
DROP POLICY IF EXISTS "Affiliates can insert their own codes" ON creator_codes;
DROP POLICY IF EXISTS "Affiliates can update their own codes" ON creator_codes;
DROP POLICY IF EXISTS "Affiliates can delete their own codes" ON creator_codes;
DROP POLICY IF EXISTS "Active codes are publicly readable" ON creator_codes;

-- Recreate policies
-- Public can read active codes (for validation during signup)
CREATE POLICY "Active codes are publicly readable"
  ON creator_codes FOR SELECT
  USING (is_active = TRUE);

-- Affiliates can view all their codes (even inactive ones)
CREATE POLICY "Affiliates can view their own codes"
  ON creator_codes FOR SELECT
  USING (user_id = auth.uid());

-- Affiliates can create codes if they are marked as affiliate
CREATE POLICY "Affiliates can insert their own codes"
  ON creator_codes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_affiliate = TRUE
    )
  );

-- Affiliates can update their own codes
CREATE POLICY "Affiliates can update their own codes"
  ON creator_codes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Affiliates can delete their own codes
CREATE POLICY "Affiliates can delete their own codes"
  ON creator_codes FOR DELETE
  USING (user_id = auth.uid());
