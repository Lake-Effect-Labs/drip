-- Migration: Drop all triggers and trigger functions
-- Business logic is now handled in TypeScript API routes
-- Only keep: get_user_company_id (RLS dependency) and create_company_with_owner (signup)

-- ============================================
-- PART 1: Drop all triggers
-- ============================================

-- Jobs triggers
DROP TRIGGER IF EXISTS job_status_change_trigger ON jobs;

-- Estimates triggers
DROP TRIGGER IF EXISTS protect_accepted_estimate ON estimates;
DROP TRIGGER IF EXISTS protect_denied_estimates ON estimates;

-- Estimate line items triggers
DROP TRIGGER IF EXISTS protect_accepted_estimate_line_items_insert ON estimate_line_items;
DROP TRIGGER IF EXISTS protect_accepted_estimate_line_items_update ON estimate_line_items;
DROP TRIGGER IF EXISTS protect_accepted_estimate_line_items_delete ON estimate_line_items;
DROP TRIGGER IF EXISTS recalculate_totals_on_line_item_insert ON estimate_line_items;
DROP TRIGGER IF EXISTS recalculate_totals_on_line_item_update ON estimate_line_items;
DROP TRIGGER IF EXISTS recalculate_totals_on_line_item_delete ON estimate_line_items;

-- Estimate materials triggers
DROP TRIGGER IF EXISTS update_estimate_materials_timestamp ON estimate_materials;
DROP TRIGGER IF EXISTS recalculate_totals_on_material_insert ON estimate_materials;
DROP TRIGGER IF EXISTS recalculate_totals_on_material_update ON estimate_materials;
DROP TRIGGER IF EXISTS recalculate_totals_on_material_delete ON estimate_materials;

-- Time entries triggers
DROP TRIGGER IF EXISTS time_entry_duration_trigger ON time_entries;

-- Referral triggers
DROP TRIGGER IF EXISTS trigger_increment_referral_count ON referrals;
DROP TRIGGER IF EXISTS trigger_increment_conversion_count ON referrals;

-- ============================================
-- PART 2: Drop trigger functions
-- (only functions used exclusively by triggers)
-- ============================================

DROP FUNCTION IF EXISTS prevent_accepted_estimate_update();
DROP FUNCTION IF EXISTS prevent_accepted_estimate_line_item_changes();
DROP FUNCTION IF EXISTS prevent_denied_estimate_modifications();
DROP FUNCTION IF EXISTS calculate_time_entry_duration();
DROP FUNCTION IF EXISTS update_estimate_materials_updated_at();
DROP FUNCTION IF EXISTS recalculate_estimate_totals();
DROP FUNCTION IF EXISTS track_job_status_change();

-- Note: increment_referral_count and increment_conversion_count were
-- overloaded (both trigger and callable versions). Drop the trigger versions.
-- The callable versions in migration 031 take a UUID param and are different signatures.
DROP FUNCTION IF EXISTS increment_referral_count();
DROP FUNCTION IF EXISTS increment_conversion_count();
