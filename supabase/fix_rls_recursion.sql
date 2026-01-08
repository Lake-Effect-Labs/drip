-- Fix RLS Infinite Recursion Issue
-- This fixes the circular dependency in company_users policies
-- Run this in Supabase SQL Editor

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view company members" ON company_users;
DROP POLICY IF EXISTS "Users can add members to their company" ON company_users;
DROP POLICY IF EXISTS "Users can remove members from their company" ON company_users;

-- Create a SECURITY DEFINER function to get user's company ID (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM company_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Recreate SELECT policy using the function (avoids recursion)
CREATE POLICY "Users can view company members" ON company_users
  FOR SELECT USING (
    user_id = auth.uid() OR 
    company_id = get_user_company_id()
  );

-- Recreate INSERT policy - allow if user owns company OR is already a member
CREATE POLICY "Users can add members to their company" ON company_users
  FOR INSERT WITH CHECK (
    -- User can add themselves if they own the company
    (user_id = auth.uid() AND company_id IN (
      SELECT id FROM companies WHERE owner_user_id = auth.uid()
    ))
    OR
    -- User can add others if they're already in the company (using function to avoid recursion)
    (company_id = get_user_company_id())
  );

-- Recreate DELETE policy using the function
CREATE POLICY "Users can remove members from their company" ON company_users
  FOR DELETE USING (company_id = get_user_company_id());

-- Also update other policies that reference company_users to use the function
-- This prevents recursion in other tables too

-- Drop and recreate companies policies
DROP POLICY IF EXISTS "Users can view their company" ON companies;
DROP POLICY IF EXISTS "Users can update their company" ON companies;

CREATE POLICY "Users can view their company" ON companies
  FOR SELECT USING (id = get_user_company_id());

CREATE POLICY "Users can update their company" ON companies
  FOR UPDATE USING (id = get_user_company_id());

-- Update all other policies that reference company_users
DROP POLICY IF EXISTS "Users can manage company customers" ON customers;
CREATE POLICY "Users can manage company customers" ON customers
  FOR ALL USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can manage company jobs" ON jobs;
CREATE POLICY "Users can manage company jobs" ON jobs
  FOR ALL USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can manage company estimates" ON estimates;
CREATE POLICY "Users can manage company estimates" ON estimates
  FOR ALL USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can manage company invoices" ON invoices;
CREATE POLICY "Users can manage company invoices" ON invoices
  FOR ALL USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can manage estimating config" ON estimating_config;
CREATE POLICY "Users can manage estimating config" ON estimating_config
  FOR ALL USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can manage pickup locations" ON pickup_locations;
CREATE POLICY "Users can manage pickup locations" ON pickup_locations
  FOR ALL USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can manage inventory items" ON inventory_items;
CREATE POLICY "Users can manage inventory items" ON inventory_items
  FOR ALL USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can view company invite links" ON invite_links;
CREATE POLICY "Users can view company invite links" ON invite_links
  FOR SELECT USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can create invite links" ON invite_links;
CREATE POLICY "Users can create invite links" ON invite_links
  FOR INSERT WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can update invite links" ON invite_links;
CREATE POLICY "Users can update invite links" ON invite_links
  FOR UPDATE USING (company_id = get_user_company_id());

-- Update nested policies (estimate_line_items, invoice_payments, job_materials)
-- These need to check through their parent tables
DROP POLICY IF EXISTS "Users can manage estimate line items" ON estimate_line_items;
CREATE POLICY "Users can manage estimate line items" ON estimate_line_items
  FOR ALL USING (
    estimate_id IN (
      SELECT id FROM estimates WHERE company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Users can view invoice payments" ON invoice_payments;
CREATE POLICY "Users can view invoice payments" ON invoice_payments
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Users can insert invoice payments" ON invoice_payments;
CREATE POLICY "Users can insert invoice payments" ON invoice_payments
  FOR INSERT WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "Users can manage job materials" ON job_materials;
CREATE POLICY "Users can manage job materials" ON job_materials
  FOR ALL USING (
    job_id IN (
      SELECT id FROM jobs WHERE company_id = get_user_company_id()
    )
  );
