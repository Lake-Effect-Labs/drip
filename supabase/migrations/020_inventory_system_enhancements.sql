-- Inventory System Enhancements for Job-Driven Material Tracking

-- Add category field to inventory_items
ALTER TABLE inventory_items
  ADD COLUMN category TEXT CHECK (category IN ('paint', 'primer', 'sundries', 'tools')) DEFAULT 'sundries';

COMMENT ON COLUMN inventory_items.category IS 'Category of inventory item: paint, primer, sundries, or tools';

-- Add notes field to inventory_items (if not exists)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN inventory_items.notes IS 'Optional notes about the inventory item';

-- Add purchased_at timestamp to job_materials to track when materials are marked as purchased
ALTER TABLE job_materials
  ADD COLUMN purchased_at TIMESTAMPTZ;

COMMENT ON COLUMN job_materials.purchased_at IS 'When the material was marked as purchased for this job';

-- Add consumed_at timestamp to job_materials to track when inventory was decremented
ALTER TABLE job_materials
  ADD COLUMN consumed_at TIMESTAMPTZ;

COMMENT ON COLUMN job_materials.consumed_at IS 'When the material was consumed/used and inventory was decremented';

-- Index for faster queries on purchased and consumed materials
CREATE INDEX idx_job_materials_purchased_at ON job_materials(purchased_at) WHERE purchased_at IS NOT NULL;
CREATE INDEX idx_job_materials_consumed_at ON job_materials(consumed_at) WHERE consumed_at IS NOT NULL;
CREATE INDEX idx_inventory_items_category ON inventory_items(category);
