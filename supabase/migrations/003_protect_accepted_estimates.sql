-- Migration: Protect Accepted Estimates
-- Prevents modification of estimates and their line items after acceptance

-- Function to prevent updates to accepted estimates
CREATE OR REPLACE FUNCTION prevent_accepted_estimate_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow status changes (e.g., from 'sent' to 'accepted')
  -- But prevent other modifications once accepted
  IF OLD.status = 'accepted' THEN
    -- Only allow updating updated_at timestamp
    IF NEW.status = OLD.status
       AND NEW.sqft IS NOT DISTINCT FROM OLD.sqft
       AND NEW.job_id IS NOT DISTINCT FROM OLD.job_id
       AND NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id THEN
      -- Allow minor updates that don't change business data
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Cannot modify an accepted estimate. Create a new estimate instead.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on estimates table
DROP TRIGGER IF EXISTS protect_accepted_estimate ON estimates;
CREATE TRIGGER protect_accepted_estimate
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION prevent_accepted_estimate_update();

-- Function to prevent modifications to line items of accepted estimates
CREATE OR REPLACE FUNCTION prevent_accepted_estimate_line_item_changes()
RETURNS TRIGGER AS $$
DECLARE
  estimate_status TEXT;
BEGIN
  -- Get the estimate status
  SELECT status INTO estimate_status
  FROM estimates
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  IF estimate_status = 'accepted' THEN
    RAISE EXCEPTION 'Cannot modify line items of an accepted estimate. Create a new estimate instead.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for line item INSERT, UPDATE, DELETE on accepted estimates
DROP TRIGGER IF EXISTS protect_accepted_estimate_line_items_insert ON estimate_line_items;
CREATE TRIGGER protect_accepted_estimate_line_items_insert
  BEFORE INSERT ON estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_accepted_estimate_line_item_changes();

DROP TRIGGER IF EXISTS protect_accepted_estimate_line_items_update ON estimate_line_items;
CREATE TRIGGER protect_accepted_estimate_line_items_update
  BEFORE UPDATE ON estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_accepted_estimate_line_item_changes();

DROP TRIGGER IF EXISTS protect_accepted_estimate_line_items_delete ON estimate_line_items;
CREATE TRIGGER protect_accepted_estimate_line_items_delete
  BEFORE DELETE ON estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_accepted_estimate_line_item_changes();
