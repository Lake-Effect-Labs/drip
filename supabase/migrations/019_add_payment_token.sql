-- Add payment token to jobs table for unified payment sharing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'payment_token') THEN
    ALTER TABLE jobs ADD COLUMN payment_token TEXT UNIQUE;
  END IF;
END $$;

-- Create index for payment_token lookups
CREATE INDEX IF NOT EXISTS idx_jobs_payment_token ON jobs(payment_token) WHERE payment_token IS NOT NULL;
