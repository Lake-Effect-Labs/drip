-- Add payment_methods field to jobs table to store available payment methods
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'payment_methods') THEN
    ALTER TABLE jobs ADD COLUMN payment_methods TEXT[] DEFAULT ARRAY['cash', 'check', 'venmo'];
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN jobs.payment_methods IS 'Array of available payment methods: stripe, cash, check, venmo';
