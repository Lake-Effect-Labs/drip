-- Storage Bucket Setup for Job Photos
-- This needs to be done manually in Supabase Dashboard or via SQL/REST API

-- 1. Create the bucket (public for easy access)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('job-photos', 'job-photos', true);

-- 2. Set up storage policies
-- Allow authenticated users in a company to upload photos
CREATE POLICY "Users can upload photos to their company jobs"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'job-photos' AND
    auth.uid() IN (
      SELECT user_id FROM company_users WHERE company_id = (
        SELECT company_id FROM jobs WHERE id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Allow authenticated users to view photos for their company jobs
CREATE POLICY "Users can view photos from their company jobs"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'job-photos' AND
    auth.uid() IN (
      SELECT user_id FROM company_users WHERE company_id = (
        SELECT company_id FROM jobs WHERE id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Allow users to delete photos from their company jobs
CREATE POLICY "Users can delete photos from their company jobs"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'job-photos' AND
    auth.uid() IN (
      SELECT user_id FROM company_users WHERE company_id = (
        SELECT company_id FROM jobs WHERE id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Note: Path structure will be: {company_id}/{job_id}/{photo_id}.{ext}
-- This allows for easy organization and access control
