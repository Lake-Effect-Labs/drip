-- Migration: Fix security issues (RLS and function search_path)
-- This migration addresses:
-- 1. RLS disabled on customer_tags, nudge_dismissals, and template_estimate_items
-- 2. Function search_path mutable warnings

-- ============================================
-- PART 1: Enable RLS on tables
-- ============================================

-- Enable RLS on customer_tags
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customer_tags (idempotent)
DROP POLICY IF EXISTS "Users can view customer tags for their company" ON customer_tags;
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

DROP POLICY IF EXISTS "Users can insert customer tags for their company" ON customer_tags;
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

DROP POLICY IF EXISTS "Users can delete customer tags for their company" ON customer_tags;
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

-- Create RLS policies for nudge_dismissals (idempotent)
DROP POLICY IF EXISTS "Users can view their own nudge dismissals" ON nudge_dismissals;
CREATE POLICY "Users can view their own nudge dismissals"
  ON nudge_dismissals FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own nudge dismissals" ON nudge_dismissals;
CREATE POLICY "Users can insert their own nudge dismissals"
  ON nudge_dismissals FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own nudge dismissals" ON nudge_dismissals;
CREATE POLICY "Users can delete their own nudge dismissals"
  ON nudge_dismissals FOR DELETE
  USING (user_id = auth.uid());

-- Enable RLS on template_estimate_items
ALTER TABLE template_estimate_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for template_estimate_items (idempotent)
-- Note: template_estimate_items doesn't have company_id directly, it references job_templates which has company_id
DROP POLICY IF EXISTS "Users can view template items for their company" ON template_estimate_items;
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

DROP POLICY IF EXISTS "Users can insert template items for their company" ON template_estimate_items;
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

DROP POLICY IF EXISTS "Users can update template items for their company" ON template_estimate_items;
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

DROP POLICY IF EXISTS "Users can delete template items for their company" ON template_estimate_items;
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
-- PART 2: Fix search_path on kept functions
-- ============================================
-- Only two functions are kept in Supabase:
-- 1. get_user_company_id (RLS dependency, SECURITY DEFINER)
-- 2. create_company_with_owner (signup flow, SECURITY DEFINER)
-- All trigger functions are dropped in migration 034.

-- create_company_with_owner
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
  INSERT INTO public.companies (name, owner_user_id)
  VALUES (company_name, owner_id)
  RETURNING id INTO new_company_id;

  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (owner_id, owner_email, owner_name)
  ON CONFLICT (id) DO UPDATE SET full_name = owner_name;

  INSERT INTO public.company_users (company_id, user_id)
  VALUES (new_company_id, owner_id);

  INSERT INTO public.estimating_config (company_id)
  VALUES (new_company_id);

  RETURN new_company_id;
END;
$$;

-- get_user_company_id
-- MUST keep SECURITY DEFINER to avoid infinite RLS recursion on company_users
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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
