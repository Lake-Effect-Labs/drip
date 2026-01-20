-- Add customer review settings to companies table
-- This enables painters to optionally prompt customers to leave Google reviews after payment

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS review_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_review_link TEXT;

-- Add a comment explaining the columns
COMMENT ON COLUMN companies.review_enabled IS 'Whether to show review prompt to customers after payment';
COMMENT ON COLUMN companies.google_review_link IS 'Google Business Profile review link URL';
