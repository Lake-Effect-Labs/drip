-- Photo Storage Policies (Run this in Supabase SQL Editor)
-- These policies allow authenticated users to upload, view, and delete photos

-- First, ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload photos to their company jobs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view photos from their company jobs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete photos from their company jobs" ON storage.objects;

-- Simple policy: Allow authenticated users to upload to job-photos bucket
CREATE POLICY "Allow authenticated uploads to job-photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'job-photos');

-- Simple policy: Allow authenticated users to view job-photos
CREATE POLICY "Allow authenticated reads from job-photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-photos');

-- Simple policy: Allow authenticated users to delete from job-photos
CREATE POLICY "Allow authenticated deletes from job-photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'job-photos');

-- Optional: Update policy for editing metadata
CREATE POLICY "Allow authenticated updates to job-photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'job-photos')
  WITH CHECK (bucket_id = 'job-photos');
