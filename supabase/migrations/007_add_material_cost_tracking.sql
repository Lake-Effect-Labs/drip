-- Material cost tracking feature
ALTER TABLE job_materials 
  ADD COLUMN cost_per_unit DECIMAL(10,2),
  ADD COLUMN quantity_decimal DECIMAL(10,2),
  ADD COLUMN unit VARCHAR(50);

COMMENT ON COLUMN job_materials.cost_per_unit IS 'Optional cost per unit for basic profitability tracking';
COMMENT ON COLUMN job_materials.quantity_decimal IS 'Decimal quantity (replaces quantity string for new materials)';
COMMENT ON COLUMN job_materials.unit IS 'Unit of measurement (gallon, each, box, etc)';
