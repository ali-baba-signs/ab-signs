BEGIN;

ALTER TABLE designs ADD COLUMN IF NOT EXISTS preview_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS front_preview_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS back_preview_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS production_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preview_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS front_preview_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS back_preview_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customer_artwork_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS production_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by_admin_id text REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note text;

CREATE TABLE IF NOT EXISTS homepage_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_title varchar(255) NOT NULL,
  headline varchar(255) NOT NULL,
  description text NOT NULL,
  image_asset_id uuid REFERENCES storage_assets(id) ON DELETE RESTRICT,
  image_url text,
  cta_label varchar(120),
  cta_url text,
  alignment varchar(20) NOT NULL DEFAULT 'image_left' CHECK (alignment IN ('image_left', 'image_right')),
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  category_id uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homepage_promotions_enabled_order_idx ON homepage_promotions(enabled, display_order);

INSERT INTO homepage_promotions (internal_title, headline, description, image_url, cta_label, cta_url, alignment, enabled, display_order)
SELECT 'Business banners', 'Turn every fence, wall and event space into an advert', 'Choose durable vinyl or mesh, select a proven size, then upload finished artwork or customise a print-ready design online.', '/vnyl banner.png', 'Build your banner', '/products?category=vinyl_banners', 'image_left', true, 0
WHERE NOT EXISTS (SELECT 1 FROM homepage_promotions);
INSERT INTO homepage_promotions (internal_title, headline, description, image_url, cta_label, cta_url, alignment, enabled, display_order)
SELECT 'Custom flags', 'Get noticed before customers reach the door', 'Create portable feather and teardrop flags for launches, entries and outdoor campaigns, with fixed hardware-ready print variants.', '/feather flag.png', 'Choose a flag format', '/products?category=flag', 'image_right', true, 1
WHERE (SELECT count(*) FROM homepage_promotions) = 1;

COMMIT;
