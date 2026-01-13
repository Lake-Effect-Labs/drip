-- Add sqft and rate fields to estimate_line_items for proper editing
ALTER TABLE estimate_line_items 
ADD COLUMN IF NOT EXISTS sqft NUMERIC,
ADD COLUMN IF NOT EXISTS rate_per_sqft NUMERIC;

-- Add comment
COMMENT ON COLUMN estimate_line_items.sqft IS 'Square feet for area-based pricing';
COMMENT ON COLUMN estimate_line_items.rate_per_sqft IS 'Rate per square foot for area-based pricing';
