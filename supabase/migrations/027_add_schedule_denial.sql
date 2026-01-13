-- Add 'denied' to schedule_state allowed values and add schedule_denied_at column
DO $$ 
BEGIN
  -- Drop the existing check constraint
  ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_schedule_state_check;
  
  -- Add the new check constraint with 'denied' option
  ALTER TABLE jobs ADD CONSTRAINT jobs_schedule_state_check 
    CHECK (schedule_state IN ('none', 'proposed', 'accepted', 'denied'));
  
  -- Add schedule_denied_at column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'schedule_denied_at') THEN
    ALTER TABLE jobs ADD COLUMN schedule_denied_at TIMESTAMPTZ;
  END IF;
  
  -- Add schedule_denial_reason column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'schedule_denial_reason') THEN
    ALTER TABLE jobs ADD COLUMN schedule_denial_reason TEXT;
  END IF;
END $$;
