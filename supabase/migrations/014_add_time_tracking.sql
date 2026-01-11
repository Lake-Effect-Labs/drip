-- Time Tracking Feature
-- Add time entries table and hourly rate to estimates

-- Add hourly_rate to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);

-- Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  user_name VARCHAR(255), -- For public time entry (crew without accounts)
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_job ON time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_company ON time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_started ON time_entries(started_at);

-- Automatic duration calculation trigger
CREATE OR REPLACE FUNCTION calculate_time_entry_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_entry_duration_trigger
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_time_entry_duration();

-- RLS Policies
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Users can view time entries for jobs in their company
CREATE POLICY "Users can view time entries in their company"
  ON time_entries
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Users can insert time entries for jobs in their company
CREATE POLICY "Users can insert time entries in their company"
  ON time_entries
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Users can update their own time entries
CREATE POLICY "Users can update their own time entries"
  ON time_entries
  FOR UPDATE
  USING (
    user_id = auth.uid() OR
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Users can delete time entries in their company
CREATE POLICY "Users can delete time entries in their company"
  ON time_entries
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );
