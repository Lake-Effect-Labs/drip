-- Add estimate_id to invoices table for tracking which estimate an invoice was created from
ALTER TABLE invoices ADD COLUMN estimate_id UUID REFERENCES estimates(id);

-- Create a unique index to prevent multiple invoices from the same estimate
CREATE UNIQUE INDEX idx_unique_estimate_invoice ON invoices(estimate_id) WHERE estimate_id IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_unique_estimate_invoice IS 'Ensures only one invoice can be created from a given estimate';
