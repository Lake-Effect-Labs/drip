-- Add SaaS subscription billing and affiliate system

-- Add subscription fields to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

-- Add constraint for subscription_status
ALTER TABLE companies
ADD CONSTRAINT companies_subscription_status_check
CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete'));

-- Create creator_codes table for affiliates
CREATE TABLE IF NOT EXISTS creator_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  creator_name TEXT NOT NULL,
  creator_email TEXT NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 10,
  commission_percent INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create referrals table to track affiliate conversions
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_code_id UUID NOT NULL REFERENCES creator_codes(id),
  visitor_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  converted_at TIMESTAMPTZ,
  subscriber_user_id UUID REFERENCES auth.users(id),
  subscriber_company_id UUID REFERENCES companies(id),
  commission_owed DECIMAL(10, 2) DEFAULT 0,
  commission_paid BOOLEAN NOT NULL DEFAULT false,
  commission_paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add is_creator flag to track affiliate accounts (using auth.users metadata instead)
-- We'll store this in the user's raw_user_meta_data

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_creator_codes_code ON creator_codes(code);
CREATE INDEX IF NOT EXISTS idx_creator_codes_user_id ON creator_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_creator_code_id ON referrals(creator_code_id);
CREATE INDEX IF NOT EXISTS idx_referrals_visitor_id ON referrals(visitor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_subscriber_user_id ON referrals(subscriber_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer_id ON companies(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);

-- RLS policies for creator_codes (only admins can manage, but codes can be read publicly for validation)
ALTER TABLE creator_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator codes are publicly readable for validation"
  ON creator_codes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can view their own creator code"
  ON creator_codes FOR SELECT
  USING (user_id = auth.uid());

-- RLS policies for referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view referrals they converted"
  ON referrals FOR SELECT
  USING (subscriber_user_id = auth.uid());

CREATE POLICY "Creators can view their referrals"
  ON referrals FOR SELECT
  USING (
    creator_code_id IN (
      SELECT id FROM creator_codes WHERE user_id = auth.uid()
    )
  );

-- Function to increment referral count
CREATE OR REPLACE FUNCTION increment_referral_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE creator_codes
  SET total_referrals = total_referrals + 1,
      updated_at = NOW()
  WHERE id = NEW.creator_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-increment referral count
DROP TRIGGER IF EXISTS trigger_increment_referral_count ON referrals;
CREATE TRIGGER trigger_increment_referral_count
  AFTER INSERT ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION increment_referral_count();

-- Function to increment conversion count
CREATE OR REPLACE FUNCTION increment_conversion_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.converted_at IS NOT NULL AND OLD.converted_at IS NULL THEN
    UPDATE creator_codes
    SET total_conversions = total_conversions + 1,
        updated_at = NOW()
    WHERE id = NEW.creator_code_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-increment conversion count
DROP TRIGGER IF EXISTS trigger_increment_conversion_count ON referrals;
CREATE TRIGGER trigger_increment_conversion_count
  AFTER UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION increment_conversion_count();
