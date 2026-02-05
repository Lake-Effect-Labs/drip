-- Fix job_photos tag CHECK constraint to include 'progress'
-- The TypeScript types already include 'progress' but the DB constraint doesn't
ALTER TABLE job_photos DROP CONSTRAINT IF EXISTS job_photos_tag_check;
ALTER TABLE job_photos ADD CONSTRAINT job_photos_tag_check
  CHECK (tag IN ('before', 'after', 'progress', 'other'));

-- Enable RLS on webhook_events (server-only table, deny all user access)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies = deny all access for authenticated users
-- Only the service_role (admin client) can read/write

-- Enable RLS on template_materials
ALTER TABLE template_materials ENABLE ROW LEVEL SECURITY;

-- template_materials policies: users can manage materials for templates in their company
CREATE POLICY "Users can view template materials in their company"
  ON template_materials
  FOR SELECT
  USING (
    template_id IN (
      SELECT jt.id FROM job_templates jt
      WHERE jt.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert template materials in their company"
  ON template_materials
  FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT jt.id FROM job_templates jt
      WHERE jt.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update template materials in their company"
  ON template_materials
  FOR UPDATE
  USING (
    template_id IN (
      SELECT jt.id FROM job_templates jt
      WHERE jt.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete template materials in their company"
  ON template_materials
  FOR DELETE
  USING (
    template_id IN (
      SELECT jt.id FROM job_templates jt
      WHERE jt.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Also enable RLS on template_estimate_items (same pattern)
ALTER TABLE template_estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view template estimate items in their company"
  ON template_estimate_items
  FOR SELECT
  USING (
    template_id IN (
      SELECT jt.id FROM job_templates jt
      WHERE jt.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert template estimate items in their company"
  ON template_estimate_items
  FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT jt.id FROM job_templates jt
      WHERE jt.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update template estimate items in their company"
  ON template_estimate_items
  FOR UPDATE
  USING (
    template_id IN (
      SELECT jt.id FROM job_templates jt
      WHERE jt.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete template estimate items in their company"
  ON template_estimate_items
  FOR DELETE
  USING (
    template_id IN (
      SELECT jt.id FROM job_templates jt
      WHERE jt.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );
