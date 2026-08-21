BEGIN;

-- The correction migration is safe whether or not the first Phase 2 migration
-- was applied. Product sizes remain the production-size authority.
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS fit_mode varchar(10) NOT NULL DEFAULT 'contain';
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS safe_margin numeric(10,3) NOT NULL DEFAULT 0;
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS bleed numeric(10,3) NOT NULL DEFAULT 3;
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS trim_marks boolean NOT NULL DEFAULT true;
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS front_template_id uuid;
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS back_template_id uuid;

ALTER TABLE templates ADD COLUMN IF NOT EXISTS product_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_product_id_products_id_fk') THEN
    ALTER TABLE templates ADD CONSTRAINT templates_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_sizes_front_template_id_fk') THEN
    ALTER TABLE product_sizes ADD CONSTRAINT product_sizes_front_template_id_fk FOREIGN KEY (front_template_id) REFERENCES templates(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_sizes_back_template_id_fk') THEN
    ALTER TABLE product_sizes ADD CONSTRAINT product_sizes_back_template_id_fk FOREIGN KEY (back_template_id) REFERENCES templates(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS templates_product_idx ON templates(product_id);
CREATE INDEX IF NOT EXISTS templates_status_product_idx ON templates(status, product_id);

-- Preserve legacy template-owned sizes as product-owned records before retiring
-- the old mode. This also repairs databases that missed the first migration.
INSERT INTO product_sizes (
  product_id, label, width, height, unit, unit_price, enabled, sort_order,
  side_mode, fit_mode, safe_margin, bleed, trim_marks, is_default
)
SELECT
  p.id, ts.label, ts.width, ts.height, ts.unit, pp.unit_price,
  (ts.enabled AND pp.enabled), ts.display_order, 'single', ts.fit_mode,
  ts.safe_margin, ts.bleed, ts.trim_marks, ts.is_default
FROM products p
JOIN product_template_size_prices pp ON pp.product_id = p.id
JOIN template_sizes ts ON ts.id = pp.template_size_id AND ts.template_id = p.template_id
WHERE p.size_mode = 'template_sizes'
  AND NOT EXISTS (
    SELECT 1 FROM product_sizes ps
    WHERE ps.product_id = p.id AND ps.label = ts.label
      AND ps.width = ts.width AND ps.height = ts.height AND ps.unit = ts.unit
  );

UPDATE products SET size_mode = 'preset_sizes' WHERE size_mode = 'template_sizes';

WITH ranked AS (
  SELECT id, product_id, row_number() OVER (PARTITION BY product_id ORDER BY enabled DESC, sort_order, created_at, id) AS position
  FROM product_sizes
), missing AS (
  SELECT product_id FROM product_sizes GROUP BY product_id HAVING bool_or(is_default) = false
)
UPDATE product_sizes ps SET is_default = true
FROM ranked r, missing
WHERE ps.id = r.id AND ps.product_id = missing.product_id AND r.position = 1;

-- A template can be compatible with any number of products.
CREATE TABLE IF NOT EXISTS template_products (
  template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT template_products_unique UNIQUE (template_id, product_id)
);
CREATE INDEX IF NOT EXISTS template_products_product_idx ON template_products(product_id);

INSERT INTO template_products (template_id, product_id)
SELECT product_id_template.template_id, product_id_template.product_id
FROM (
  SELECT id AS template_id, product_id FROM templates WHERE product_id IS NOT NULL
  UNION
  SELECT template_id, id FROM products WHERE template_id IS NOT NULL
  UNION
  SELECT front_template_id, product_id FROM product_sizes WHERE front_template_id IS NOT NULL
  UNION
  SELECT back_template_id, product_id FROM product_sizes WHERE back_template_id IS NOT NULL
) product_id_template
ON CONFLICT DO NOTHING;

COMMIT;
