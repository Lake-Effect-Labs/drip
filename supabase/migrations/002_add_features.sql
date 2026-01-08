-- Migration: Add features for Drip Lite
-- Job Templates, Job History, Message Templates

-- Job Templates
CREATE TABLE IF NOT EXISTS job_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_materials TEXT[], -- Array of material names
  default_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job History (track status changes)
CREATE TABLE IF NOT EXISTS job_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sms', 'email')),
  subject TEXT, -- For email only
  body TEXT NOT NULL,
  variables TEXT[], -- e.g., ['customer_name', 'job_date', 'amount']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_job_templates_company_id ON job_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history(job_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_company_id ON message_templates(company_id);

-- Enable RLS
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage company job templates" ON job_templates
  FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Users can view job history" ON job_history
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM jobs WHERE company_id = get_user_company_id()
    )
  );

CREATE POLICY "Users can create job history" ON job_history
  FOR INSERT WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE company_id = get_user_company_id()
    )
  );

CREATE POLICY "Users can manage company message templates" ON message_templates
  FOR ALL USING (company_id = get_user_company_id());

-- Add trigger to track job status changes
CREATE OR REPLACE FUNCTION track_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO job_history (job_id, status, changed_by, changed_at)
    VALUES (NEW.id, NEW.status, auth.uid(), NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS job_status_change_trigger ON jobs;
CREATE TRIGGER job_status_change_trigger
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION track_job_status_change();

-- Insert default message templates
INSERT INTO message_templates (company_id, name, type, subject, body, variables)
SELECT 
  id,
  'Job Scheduled',
  'sms',
  NULL,
  'Hey {{customer_name}} — just a reminder that we''re scheduled for {{job_date}} at {{job_time}} at {{job_address}}. Reply here if anything changes. See you then!',
  ARRAY['customer_name', 'job_date', 'job_time', 'job_address']
FROM companies
ON CONFLICT DO NOTHING;

INSERT INTO message_templates (company_id, name, type, subject, body, variables)
SELECT 
  id,
  'Payment Reminder',
  'sms',
  NULL,
  'Hey {{customer_name}} — thanks again for letting us work on your project! Here''s your invoice for {{amount}}: {{invoice_link}}. Let us know if you have any questions!',
  ARRAY['customer_name', 'amount', 'invoice_link']
FROM companies
ON CONFLICT DO NOTHING;

INSERT INTO message_templates (company_id, name, type, subject, body, variables)
SELECT 
  id,
  'Job Complete',
  'sms',
  NULL,
  'Hey {{customer_name}} — we''ve finished the work at {{job_address}}! Let us know if you need anything else.',
  ARRAY['customer_name', 'job_address']
FROM companies
ON CONFLICT DO NOTHING;
