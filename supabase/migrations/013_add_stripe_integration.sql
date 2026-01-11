-- Stripe Payment Integration
-- Add Stripe fields to companies and invoices

ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE;

-- Note: invoices table already has stripe_checkout_session_id and stripe_checkout_url
-- from earlier migrations, but let's make sure they exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'stripe_checkout_session_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN stripe_checkout_session_id VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'stripe_checkout_url'
  ) THEN
    ALTER TABLE invoices ADD COLUMN stripe_checkout_url TEXT;
  END IF;
END $$;
