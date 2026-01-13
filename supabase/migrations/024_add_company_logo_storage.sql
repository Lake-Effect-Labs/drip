-- Company Logo Storage Setup
-- This migration sets up storage for company logos

-- Create the company-logos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company logos
-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Company owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view company logos" ON storage.objects;
DROP POLICY IF EXISTS "Company owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Company owners can delete logos" ON storage.objects;

-- Allow authenticated company owners to upload logos
-- Ownership is determined by companies.owner_user_id
CREATE POLICY "Company owners can upload logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos' AND
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM companies WHERE owner_user_id = auth.uid()
    )
  );

-- Allow public to view logos (for customer-facing pages)
CREATE POLICY "Public can view company logos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'company-logos');

-- Allow company owners to update their logos
CREATE POLICY "Company owners can update logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos' AND
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM companies WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'company-logos' AND
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM companies WHERE owner_user_id = auth.uid()
    )
  );

-- Allow company owners to delete their logos
CREATE POLICY "Company owners can delete logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos' AND
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM companies WHERE owner_user_id = auth.uid()
    )
  );

-- Note: Path structure will be: {company_id}/logo/{logo_id}.{ext}
