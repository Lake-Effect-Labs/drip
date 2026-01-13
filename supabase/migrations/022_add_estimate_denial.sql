-- Add denial tracking to estimates
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS denied_at TIMESTAMPTZ;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS denial_reason TEXT;

-- Add sent_at timestamp to track when estimates are sent
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Update status check constraint to include 'denied'
-- First, drop the old constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'estimates_status_check'
    ) THEN
        ALTER TABLE estimates DROP CONSTRAINT estimates_status_check;
    END IF;
END $$;

-- Add new constraint with 'denied' status
ALTER TABLE estimates ADD CONSTRAINT estimates_status_check
    CHECK (status IN ('draft', 'sent', 'accepted', 'denied'));

-- Function to prevent modifications to denied estimates
CREATE OR REPLACE FUNCTION prevent_denied_estimate_modifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow status updates from 'denied' to other states (for resending)
  IF OLD.status = 'denied' AND NEW.status != OLD.status THEN
    RETURN NEW;
  END IF;

  -- Prevent other modifications to denied estimates
  IF OLD.status = 'denied' AND NEW.status = 'denied' THEN
    RAISE EXCEPTION 'Cannot modify a denied estimate. Please update status first.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce denied estimate protection
DROP TRIGGER IF EXISTS protect_denied_estimates ON estimates;
CREATE TRIGGER protect_denied_estimates
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  WHEN (OLD.status = 'denied' AND NEW.status = 'denied')
  EXECUTE FUNCTION prevent_denied_estimate_modifications();

-- Comment explaining the status flow
COMMENT ON COLUMN estimates.status IS 'Status of estimate: draft (not sent), sent (waiting for response), accepted (approved by customer), denied (rejected by customer)';
COMMENT ON COLUMN estimates.denied_at IS 'Timestamp when estimate was denied by customer';
COMMENT ON COLUMN estimates.denial_reason IS 'Optional reason provided by customer for denying estimate';
COMMENT ON COLUMN estimates.sent_at IS 'Timestamp when estimate was first sent to customer';
