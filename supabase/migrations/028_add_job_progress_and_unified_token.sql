-- Add progress_percentage to jobs table for tracking job completion
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'progress_percentage') THEN
    ALTER TABLE jobs ADD COLUMN progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
  END IF;
END $$;

-- Add unified_job_token for the new unified public view
-- This will replace separate estimate/schedule/payment tokens
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'unified_job_token') THEN
    ALTER TABLE jobs ADD COLUMN unified_job_token TEXT UNIQUE;
  END IF;
END $$;

-- Create index for unified_job_token lookups
CREATE INDEX IF NOT EXISTS idx_jobs_unified_job_token ON jobs(unified_job_token) WHERE unified_job_token IS NOT NULL;

-- Add comment
COMMENT ON COLUMN jobs.progress_percentage IS 'Job completion percentage (0-100), updated by company, visible to customer';
COMMENT ON COLUMN jobs.unified_job_token IS 'Unified token for public job view combining estimate, schedule, progress, payment, and invoice';
