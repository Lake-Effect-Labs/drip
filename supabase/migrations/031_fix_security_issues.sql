-- Migration: Fix security issues (RLS and function search_path)
-- This migration addresses:
-- 1. RLS disabled on customer_tags, nudge_dismissals, and template_estimate_items
-- 2. Function search_path mutable warnings

-- ============================================
-- PART 1: Enable RLS on tables
-- ============================================

-- Enable RLS on customer_tags
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customer_tags
CREATE POLICY "Users can view customer tags for their company"
  ON customer_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      JOIN company_users cu ON cu.company_id = c.company_id
      WHERE c.id = customer_tags.customer_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert customer tags for their company"
  ON customer_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      JOIN company_users cu ON cu.company_id = c.company_id
      WHERE c.id = customer_tags.customer_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete customer tags for their company"
  ON customer_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      JOIN company_users cu ON cu.company_id = c.company_id
      WHERE c.id = customer_tags.customer_id
      AND cu.user_id = auth.uid()
    )
  );

-- Enable RLS on nudge_dismissals
ALTER TABLE nudge_dismissals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for nudge_dismissals
CREATE POLICY "Users can view their own nudge dismissals"
  ON nudge_dismissals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own nudge dismissals"
  ON nudge_dismissals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own nudge dismissals"
  ON nudge_dismissals FOR DELETE
  USING (user_id = auth.uid());

-- Enable RLS on template_estimate_items
ALTER TABLE template_estimate_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for template_estimate_items
-- Note: template_estimate_items doesn't have company_id directly, it references job_templates which has company_id
CREATE POLICY "Users can view template items for their company"
  ON template_estimate_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_templates jt
      JOIN company_users cu ON cu.company_id = jt.company_id
      WHERE jt.id = template_estimate_items.template_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert template items for their company"
  ON template_estimate_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_templates jt
      JOIN company_users cu ON cu.company_id = jt.company_id
      WHERE jt.id = template_estimate_items.template_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update template items for their company"
  ON template_estimate_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM job_templates jt
      JOIN company_users cu ON cu.company_id = jt.company_id
      WHERE jt.id = template_estimate_items.template_id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete template items for their company"
  ON template_estimate_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM job_templates jt
      JOIN company_users cu ON cu.company_id = jt.company_id
      WHERE jt.id = template_estimate_items.template_id
      AND cu.user_id = auth.uid()
    )
  );

-- ============================================
-- PART 2: Fix function search_path warnings
-- ============================================

-- Recreate functions with search_path set to empty string for security

-- prevent_accepted_estimate_update
CREATE OR REPLACE FUNCTION prevent_accepted_estimate_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'accepted' THEN
    RAISE EXCEPTION 'Cannot modify an accepted estimate. Create a new estimate instead.';
  END IF;
  RETURN NEW;
END;
$$;

-- prevent_accepted_estimate_line_item_changes
CREATE OR REPLACE FUNCTION prevent_accepted_estimate_line_item_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  estimate_status TEXT;
BEGIN
  SELECT status INTO estimate_status
  FROM public.estimates
  WHERE id = COALESCE(OLD.estimate_id, NEW.estimate_id);

  IF estimate_status = 'accepted' THEN
    RAISE EXCEPTION 'Cannot modify line items of an accepted estimate. Create a new estimate instead.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- calculate_time_entry_duration
CREATE OR REPLACE FUNCTION calculate_time_entry_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$;

-- update_estimate_materials_updated_at
CREATE OR REPLACE FUNCTION update_estimate_materials_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- increment_referral_count
CREATE OR REPLACE FUNCTION increment_referral_count(affiliate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.affiliates
  SET referral_count = referral_count + 1
  WHERE id = affiliate_id;
END;
$$;

-- increment_conversion_count
CREATE OR REPLACE FUNCTION increment_conversion_count(affiliate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.affiliates
  SET conversion_count = conversion_count + 1
  WHERE id = affiliate_id;
END;
$$;

-- recalculate_estimate_totals
CREATE OR REPLACE FUNCTION recalculate_estimate_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  target_estimate_id UUID;
  new_labor_total INTEGER;
  new_materials_total INTEGER;
BEGIN
  -- Determine which estimate to recalculate
  IF TG_TABLE_NAME = 'estimate_line_items' THEN
    target_estimate_id := COALESCE(NEW.estimate_id, OLD.estimate_id);
  ELSIF TG_TABLE_NAME = 'estimate_materials' THEN
    target_estimate_id := COALESCE(NEW.estimate_id, OLD.estimate_id);
  END IF;

  IF target_estimate_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate labor total from line items
  SELECT COALESCE(SUM(price), 0) INTO new_labor_total
  FROM public.estimate_line_items
  WHERE estimate_id = target_estimate_id;

  -- Calculate materials total from estimate_materials
  SELECT COALESCE(SUM(line_total), 0) INTO new_materials_total
  FROM public.estimate_materials
  WHERE estimate_id = target_estimate_id;

  -- Update the estimate totals
  UPDATE public.estimates
  SET
    labor_total = new_labor_total,
    materials_total = new_materials_total,
    updated_at = NOW()
  WHERE id = target_estimate_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- prevent_denied_estimate_modifications
CREATE OR REPLACE FUNCTION prevent_denied_estimate_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'denied' AND NEW.status != 'draft' THEN
    -- Allow reverting to draft
    IF NEW.status = 'denied' THEN
      RAISE EXCEPTION 'Cannot modify a denied estimate. You may revert it to draft first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- create_company_with_owner
-- Preserves the original 4-parameter signature from migration 001
-- while adding search_path security fix
CREATE OR REPLACE FUNCTION create_company_with_owner(
  company_name TEXT,
  owner_id UUID,
  owner_email TEXT,
  owner_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Create the company
  INSERT INTO public.companies (name, owner_user_id)
  VALUES (company_name, owner_id)
  RETURNING id INTO new_company_id;

  -- Create user profile
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (owner_id, owner_email, owner_name)
  ON CONFLICT (id) DO UPDATE SET full_name = owner_name;

  -- Add owner to company_users
  INSERT INTO public.company_users (company_id, user_id)
  VALUES (new_company_id, owner_id);

  -- Create default estimating config
  INSERT INTO public.estimating_config (company_id)
  VALUES (new_company_id);

  RETURN new_company_id;
END;
$$;

-- get_user_company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  company_id UUID;
BEGIN
  SELECT cu.company_id INTO company_id
  FROM public.company_users cu
  WHERE cu.user_id = auth.uid()
  LIMIT 1;

  RETURN company_id;
END;
$$;

-- track_job_status_change
CREATE OR REPLACE FUNCTION track_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- If status changed to 'done', set done_at
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    NEW.done_at = NOW();
  END IF;

  -- If status changed from 'done', clear done_at
  IF OLD.status = 'done' AND NEW.status != 'done' THEN
    NEW.done_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;
