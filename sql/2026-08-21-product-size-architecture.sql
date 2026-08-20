BEGIN;

-- Product sizes are the sole current production-size authority. The legacy
-- template size tables remain only because historical orders reference them.
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS fit_mode varchar(10) NOT NULL DEFAULT 'contain';
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS safe_margin numeric(10,3) NOT NULL DEFAULT 0;
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS bleed numeric(10,3) NOT NULL DEFAULT 3;
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS trim_marks boolean NOT NULL DEFAULT true;
ALTER TABLE product_sizes ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

ALTER TABLE templates ADD COLUMN IF NOT EXISTS product_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_product_id_products_id_fk') THEN
    ALTER TABLE templates ADD CONSTRAINT templates_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS templates_product_idx ON templates(product_id);
CREATE INDEX IF NOT EXISTS templates_status_product_idx ON templates(status, product_id);

-- Preserve every existing template-driven product size before retiring that
-- mode. Prices remain product-owned and physical dimensions are copied once.
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

-- Link templates to their existing products. Variant mappings are considered
-- after the canonical product-template relationship.
WITH candidates AS (
  SELECT template_id, id AS product_id, 1 AS priority FROM products WHERE template_id IS NOT NULL
  UNION ALL
  SELECT front_template_id, product_id, 2 FROM product_sizes WHERE front_template_id IS NOT NULL
  UNION ALL
  SELECT back_template_id, product_id, 3 FROM product_sizes WHERE back_template_id IS NOT NULL
), chosen AS (
  SELECT DISTINCT ON (template_id) template_id, product_id
  FROM candidates
  ORDER BY template_id, priority, product_id
)
UPDATE templates t SET product_id = chosen.product_id
FROM chosen WHERE chosen.template_id = t.id AND t.product_id IS NULL;

UPDATE products SET size_mode = 'preset_sizes' WHERE size_mode = 'template_sizes';

-- Guarantee one default enabled size per product without manufacturing sizes.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY product_id ORDER BY enabled DESC, sort_order, created_at, id) AS position
  FROM product_sizes
), products_without_default AS (
  SELECT product_id FROM product_sizes GROUP BY product_id HAVING bool_or(is_default) = false
)
UPDATE product_sizes ps SET is_default = true
FROM ranked r, products_without_default missing
WHERE ps.id = r.id AND ps.product_id = missing.product_id AND r.position = 1;

COMMIT;
