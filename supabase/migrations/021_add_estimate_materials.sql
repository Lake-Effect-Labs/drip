-- Create estimate_materials table
-- This makes materials first-class citizens of estimates
CREATE TABLE IF NOT EXISTS estimate_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,

  -- Material identification
  name TEXT NOT NULL, -- e.g., "Interior Wall Paint - Living Room"

  -- Paint-specific details
  paint_product TEXT, -- e.g., "Sherwin Williams Duration"
  product_line TEXT, -- e.g., "Duration", "ProClassic"
  color_name TEXT, -- e.g., "Agreeable Gray"
  color_code TEXT, -- e.g., "SW 7029"
  sheen TEXT, -- e.g., "Eggshell", "Satin", "Flat", etc.

  -- Area/room association
  area_description TEXT, -- e.g., "Living Room Walls", "Master Bedroom Ceiling"

  -- Quantity and cost
  quantity_gallons NUMERIC(10,2), -- Paint quantity in gallons
  cost_per_gallon NUMERIC(10,2), -- Cost per gallon in dollars
  line_total INTEGER, -- Total cost in cents (quantity * cost_per_gallon * 100)

  -- Linking and tracking
  estimate_line_item_id UUID REFERENCES estimate_line_items(id) ON DELETE SET NULL, -- Optional link to source line item
  vendor_sku TEXT, -- SKU for inventory tracking

  -- Notes and metadata
  notes TEXT,
  is_auto_generated BOOLEAN DEFAULT true, -- Track if auto-generated or manually added

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_estimate_materials_estimate_id ON estimate_materials(estimate_id);
CREATE INDEX idx_estimate_materials_line_item_id ON estimate_materials(estimate_line_item_id);

-- RLS Policies (same as estimate_line_items)
ALTER TABLE estimate_materials ENABLE ROW LEVEL SECURITY;

-- Users can view materials for estimates in their company
CREATE POLICY "Users can view estimate materials in their company"
  ON estimate_materials
  FOR SELECT
  USING (
    estimate_id IN (
      SELECT id FROM estimates WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Users can insert materials for estimates in their company
CREATE POLICY "Users can insert estimate materials in their company"
  ON estimate_materials
  FOR INSERT
  WITH CHECK (
    estimate_id IN (
      SELECT id FROM estimates WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Users can update materials for estimates in their company (unless estimate is accepted)
CREATE POLICY "Users can update estimate materials in their company"
  ON estimate_materials
  FOR UPDATE
  USING (
    estimate_id IN (
      SELECT id FROM estimates
      WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
      AND status != 'accepted' -- Protect accepted estimates
    )
  );

-- Users can delete materials for estimates in their company (unless estimate is accepted)
CREATE POLICY "Users can delete estimate materials in their company"
  ON estimate_materials
  FOR DELETE
  USING (
    estimate_id IN (
      SELECT id FROM estimates
      WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
      AND status != 'accepted' -- Protect accepted estimates
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_estimate_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_estimate_materials_timestamp
  BEFORE UPDATE ON estimate_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_materials_updated_at();

-- Add labor_total and materials_total columns to estimates table for caching
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS labor_total INTEGER DEFAULT 0; -- Total labor cost in cents
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS materials_total INTEGER DEFAULT 0; -- Total materials cost in cents

-- Function to recalculate estimate totals
CREATE OR REPLACE FUNCTION recalculate_estimate_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_estimate_id UUID;
  v_labor_total INTEGER;
  v_materials_total INTEGER;
BEGIN
  -- Get the estimate_id from the trigger
  IF TG_OP = 'DELETE' THEN
    v_estimate_id := OLD.estimate_id;
  ELSE
    v_estimate_id := NEW.estimate_id;
  END IF;

  -- Calculate labor total from line items
  SELECT COALESCE(SUM(price), 0) INTO v_labor_total
  FROM estimate_line_items
  WHERE estimate_id = v_estimate_id;

  -- Calculate materials total from materials
  SELECT COALESCE(SUM(line_total), 0) INTO v_materials_total
  FROM estimate_materials
  WHERE estimate_id = v_estimate_id;

  -- Update the estimate with new totals
  UPDATE estimates
  SET labor_total = v_labor_total,
      materials_total = v_materials_total,
      updated_at = NOW()
  WHERE id = v_estimate_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to recalculate totals when materials change
CREATE TRIGGER recalculate_totals_on_material_insert
  AFTER INSERT ON estimate_materials
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_estimate_totals();

CREATE TRIGGER recalculate_totals_on_material_update
  AFTER UPDATE ON estimate_materials
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_estimate_totals();

CREATE TRIGGER recalculate_totals_on_material_delete
  AFTER DELETE ON estimate_materials
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_estimate_totals();

-- Also recalculate when line items change
CREATE TRIGGER recalculate_totals_on_line_item_insert
  AFTER INSERT ON estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_estimate_totals();

CREATE TRIGGER recalculate_totals_on_line_item_update
  AFTER UPDATE ON estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_estimate_totals();

CREATE TRIGGER recalculate_totals_on_line_item_delete
  AFTER DELETE ON estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_estimate_totals();
