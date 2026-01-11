-- Photo Attachments Feature
-- Adds ability to upload photos to jobs

CREATE TABLE IF NOT EXISTS job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name VARCHAR(255),
  file_size_bytes INT,
  mime_type VARCHAR(50),
  tag VARCHAR(20) CHECK (tag IN ('before', 'after', 'other')),
  caption TEXT,
  uploaded_by_user_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_photos_job ON job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_company ON job_photos(company_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_tag ON job_photos(tag);

-- RLS Policies
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

-- Users can view photos for jobs in their company
CREATE POLICY "Users can view photos in their company"
  ON job_photos
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Users can insert photos for jobs in their company
CREATE POLICY "Users can insert photos in their company"
  ON job_photos
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Users can update photos in their company
CREATE POLICY "Users can update photos in their company"
  ON job_photos
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Users can delete photos in their company
CREATE POLICY "Users can delete photos in their company"
  ON job_photos
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );
