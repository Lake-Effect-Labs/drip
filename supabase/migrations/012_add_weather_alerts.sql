-- Weather Alerts Feature
-- Add is_outdoor flag to jobs table

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN DEFAULT FALSE;

-- Add index for outdoor jobs query optimization
CREATE INDEX IF NOT EXISTS idx_jobs_is_outdoor_scheduled ON jobs(is_outdoor, scheduled_date)
  WHERE is_outdoor = TRUE AND scheduled_date IS NOT NULL;
