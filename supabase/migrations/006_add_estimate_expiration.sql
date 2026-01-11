-- Estimate expiration feature
ALTER TABLE estimates ADD COLUMN expires_at TIMESTAMPTZ;

COMMENT ON COLUMN estimates.expires_at IS 'Optional expiration date for estimate. If set, estimate should not be accepted after this date.';
