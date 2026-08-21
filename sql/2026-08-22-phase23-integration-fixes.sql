BEGIN;

-- Offer imagery is stored through the existing asset registry rather than as
-- manually entered URLs. Legacy URL columns remain readable during migration.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS image_asset_id uuid;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS mobile_image_asset_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_image_asset_id_storage_assets_id_fk') THEN
    ALTER TABLE offers ADD CONSTRAINT offers_image_asset_id_storage_assets_id_fk FOREIGN KEY (image_asset_id) REFERENCES storage_assets(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_mobile_image_asset_id_storage_assets_id_fk') THEN
    ALTER TABLE offers ADD CONSTRAINT offers_mobile_image_asset_id_storage_assets_id_fk FOREIGN KEY (mobile_image_asset_id) REFERENCES storage_assets(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS offers_image_asset_idx ON offers(image_asset_id);

-- A hero may point to an offer. The homepage resolves title, discount, CTA,
-- and images from that offer instead of copying campaign data into the slide.
ALTER TABLE hero_slides ADD COLUMN IF NOT EXISTS offer_id uuid;
ALTER TABLE hero_slides ALTER COLUMN desktop_asset_id DROP NOT NULL;
ALTER TABLE hero_slides ALTER COLUMN alt_text DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hero_slides_offer_id_offers_id_fk') THEN
    ALTER TABLE hero_slides ADD CONSTRAINT hero_slides_offer_id_offers_id_fk FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS hero_slides_offer_idx ON hero_slides(offer_id);

COMMIT;
