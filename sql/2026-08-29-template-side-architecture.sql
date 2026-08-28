-- Backward-compatible front/back template architecture.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS design_mode varchar(20) NOT NULL DEFAULT 'single_side';

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS template_side varchar(10) NOT NULL DEFAULT 'single';

-- Infer existing double-sided products and template roles from the current
-- per-size assignments. Unassigned legacy products/templates remain single.
UPDATE products p
SET design_mode = 'double_side'
WHERE EXISTS (
  SELECT 1 FROM product_sizes ps
  WHERE ps.product_id = p.id AND ps.side_mode = 'double'
);

UPDATE templates t
SET template_side = 'front'
WHERE EXISTS (
  SELECT 1 FROM product_sizes ps
  WHERE ps.front_template_id = t.id AND ps.side_mode = 'double'
);

UPDATE templates t
SET template_side = 'back'
WHERE EXISTS (
  SELECT 1 FROM product_sizes ps
  WHERE ps.back_template_id = t.id
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_design_mode_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_design_mode_check CHECK (design_mode IN ('single_side', 'double_side'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_template_side_check') THEN
    ALTER TABLE templates ADD CONSTRAINT templates_template_side_check CHECK (template_side IN ('single', 'front', 'back'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS templates_customer_listing_idx
  ON templates(template_side, status, conversion_status);
