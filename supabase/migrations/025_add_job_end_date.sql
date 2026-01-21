-- Add scheduled_end_date column to jobs table for multi-week job support
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'scheduled_end_date') THEN
    ALTER TABLE jobs ADD COLUMN scheduled_end_date DATE;
  END IF;
END $$;

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date_range ON jobs(scheduled_date, scheduled_end_date) 
WHERE scheduled_date IS NOT NULL;
