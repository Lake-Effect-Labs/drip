-- Add labor rate per hour to estimating config
ALTER TABLE estimating_config ADD COLUMN IF NOT EXISTS labor_rate_per_hour NUMERIC DEFAULT 50.00;
