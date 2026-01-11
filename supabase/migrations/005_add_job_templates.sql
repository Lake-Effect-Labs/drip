-- Job Templates enhancement - work with existing table from 002_add_features.sql
-- Add new fields to existing job_templates table
ALTER TABLE job_templates 
  ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES user_profiles(id);

-- Add unique constraint for template names per company (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_template_name_per_company'
  ) THEN
    ALTER TABLE job_templates 
      ADD CONSTRAINT unique_template_name_per_company 
      UNIQUE (company_id, name);
  END IF;
END $$;

-- Template materials (separate table for better structure)
-- Only create if doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'template_materials') THEN
    CREATE TABLE template_materials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      quantity VARCHAR(50),
      notes TEXT,
      sort_order INT DEFAULT 0
    );
    CREATE INDEX idx_template_materials_template ON template_materials(template_id);
  END IF;
END $$;

-- Template estimate items (structure only, no prices)
-- Only create if doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'template_estimate_items') THEN
    CREATE TABLE template_estimate_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
      service_type VARCHAR(50),
      name VARCHAR(255),
      description TEXT,
      sort_order INT DEFAULT 0
    );
    CREATE INDEX idx_template_estimate_items_template ON template_estimate_items(template_id);
  END IF;
END $$;
