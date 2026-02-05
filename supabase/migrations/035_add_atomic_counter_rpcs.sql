-- Atomic increment functions for affiliate counters
-- Replaces read-then-write pattern that has race conditions

CREATE OR REPLACE FUNCTION increment_total_referrals(code_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE creator_codes
  SET total_referrals = total_referrals + 1,
      updated_at = NOW()
  WHERE id = code_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_total_conversions(code_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE creator_codes
  SET total_conversions = total_conversions + 1,
      updated_at = NOW()
  WHERE id = code_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
