-- Add schedule state and token to jobs table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'schedule_state') THEN
    ALTER TABLE jobs ADD COLUMN schedule_state TEXT DEFAULT 'none' CHECK (schedule_state IN ('none', 'proposed', 'accepted'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'schedule_token') THEN
    ALTER TABLE jobs ADD COLUMN schedule_token TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'schedule_accepted_at') THEN
    ALTER TABLE jobs ADD COLUMN schedule_accepted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for schedule_token lookups
CREATE INDEX IF NOT EXISTS idx_jobs_schedule_token ON jobs(schedule_token) WHERE schedule_token IS NOT NULL;
