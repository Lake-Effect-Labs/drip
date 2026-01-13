-- Add customer signoff/agreement functionality to estimates

-- Add signoff columns to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS requires_signoff BOOLEAN DEFAULT false;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS signoff_completed_at TIMESTAMPTZ;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS signoff_customer_name TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS signoff_ip_address TEXT;

-- Create table for signoff acknowledgments (what customer agreed to)
CREATE TABLE IF NOT EXISTS estimate_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,

  -- Customer information
  customer_name TEXT NOT NULL,
  customer_signature TEXT, -- For future digital signature support
  ip_address TEXT,
  user_agent TEXT,

  -- Acknowledgment
  acknowledged_scope BOOLEAN NOT NULL DEFAULT false,
  acknowledged_materials BOOLEAN NOT NULL DEFAULT false,
  acknowledged_areas BOOLEAN NOT NULL DEFAULT false,
  acknowledged_terms BOOLEAN NOT NULL DEFAULT false,

  -- What they agreed to (snapshot at time of signing)
  scope_summary TEXT, -- Brief description of work
  materials_summary TEXT, -- List of paint products
  areas_summary TEXT, -- Areas included

  -- Timestamps
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_estimate_signoffs_estimate_id ON estimate_signoffs(estimate_id);

-- RLS Policies for estimate_signoffs
ALTER TABLE estimate_signoffs ENABLE ROW LEVEL SECURITY;

-- Company users can view signoffs for their estimates
CREATE POLICY "Users can view signoffs for their company estimates"
  ON estimate_signoffs
  FOR SELECT
  USING (
    estimate_id IN (
      SELECT id FROM estimates WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Anyone with the estimate token can insert signoff (public endpoint handles this)
-- No RLS policy needed as this is handled by the API endpoint with admin client

-- Comments
COMMENT ON COLUMN estimates.requires_signoff IS 'Whether customer must sign acknowledgment before accepting estimate';
COMMENT ON COLUMN estimates.signoff_completed_at IS 'Timestamp when customer completed signoff';
COMMENT ON COLUMN estimates.signoff_customer_name IS 'Name provided by customer during signoff';
COMMENT ON TABLE estimate_signoffs IS 'Stores customer signoff/agreement data for estimates';
