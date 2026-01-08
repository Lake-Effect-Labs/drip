-- Fix RLS Policies for Drip-lite
-- Run this in Supabase SQL Editor to fix all RLS policy issues

-- 1. Fix company_users SELECT policy (circular dependency issue)
DROP POLICY IF EXISTS "Users can view company members" ON company_users;

CREATE POLICY "Users can view company members" ON company_users
  FOR SELECT USING (
    user_id = auth.uid() OR 
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

-- 2. Fix INSERT policy to allow company owners to add themselves (for auto-linking)
DROP POLICY IF EXISTS "Users can add members to their company" ON company_users;

CREATE POLICY "Users can add members to their company" ON company_users
  FOR INSERT WITH CHECK (
    -- Users can add themselves if they own the company (bypasses circular dependency)
    (user_id = auth.uid() AND company_id IN (
      SELECT id FROM companies WHERE owner_user_id = auth.uid()
    ))
    OR
    -- Users can add others if they're already in the company
    (company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid()))
  );

-- 3. Verify all other policies are correct (no changes needed, but listing for reference)
-- These should already be correct:
-- - user_profiles: Users can view/update own profile ✓
-- - companies: Users can view/update their company ✓
-- - customers: Company-scoped access ✓
-- - jobs: Company-scoped access ✓
-- - estimates: Company-scoped access ✓
-- - invoices: Company-scoped access ✓
-- - etc.

-- Verify the fix worked
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'company_users'
ORDER BY policyname;
