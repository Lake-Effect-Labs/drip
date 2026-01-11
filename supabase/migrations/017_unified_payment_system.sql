-- Unified Payment System for Matte Lite
-- Combines estimates and invoices into a single payment concept

-- Add payment state to jobs (with IF NOT EXISTS checks)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'payment_state') THEN
    ALTER TABLE jobs ADD COLUMN payment_state TEXT DEFAULT 'none' CHECK (payment_state IN ('none', 'proposed', 'approved', 'due', 'paid'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'payment_amount') THEN
    ALTER TABLE jobs ADD COLUMN payment_amount INTEGER; -- in cents
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'payment_approved_at') THEN
    ALTER TABLE jobs ADD COLUMN payment_approved_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'payment_paid_at') THEN
    ALTER TABLE jobs ADD COLUMN payment_paid_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'payment_method') THEN
    ALTER TABLE jobs ADD COLUMN payment_method TEXT;
  END IF;
END $$;

-- Add line items directly to jobs (simplified)
CREATE TABLE IF NOT EXISTS job_payment_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price INTEGER NOT NULL, -- in cents
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_payment_line_items_job ON job_payment_line_items(job_id);

-- Enable RLS
ALTER TABLE job_payment_line_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view line items for their company jobs" ON job_payment_line_items;
DROP POLICY IF EXISTS "Users can insert line items for their company jobs" ON job_payment_line_items;
DROP POLICY IF EXISTS "Users can update line items for their company jobs" ON job_payment_line_items;
DROP POLICY IF EXISTS "Users can delete line items for their company jobs" ON job_payment_line_items;

-- RLS policies for line items
CREATE POLICY "Users can view line items for their company jobs"
  ON job_payment_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_payment_line_items.job_id
      AND jobs.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert line items for their company jobs"
  ON job_payment_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_payment_line_items.job_id
      AND jobs.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update line items for their company jobs"
  ON job_payment_line_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_payment_line_items.job_id
      AND jobs.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete line items for their company jobs"
  ON job_payment_line_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_payment_line_items.job_id
      AND jobs.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Add payment revision tracking
CREATE TABLE IF NOT EXISTS job_payment_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  previous_amount INTEGER NOT NULL,
  new_amount INTEGER NOT NULL,
  revision_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_job_payment_revisions_job ON job_payment_revisions(job_id);

ALTER TABLE job_payment_revisions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view payment revisions for their company jobs" ON job_payment_revisions;
DROP POLICY IF EXISTS "Users can insert payment revisions for their company jobs" ON job_payment_revisions;

CREATE POLICY "Users can view payment revisions for their company jobs"
  ON job_payment_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_payment_revisions.job_id
      AND jobs.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert payment revisions for their company jobs"
  ON job_payment_revisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_payment_revisions.job_id
      AND jobs.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Comment explaining the system
COMMENT ON COLUMN jobs.payment_state IS 'Unified payment state: none → proposed → approved → due → paid';
COMMENT ON COLUMN jobs.payment_amount IS 'Total payment amount in cents';
COMMENT ON TABLE job_payment_line_items IS 'Line items for the unified payment (replaces estimate line items)';
COMMENT ON TABLE job_payment_revisions IS 'Tracks when approved prices are revised';
