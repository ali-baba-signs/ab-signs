BEGIN;

ALTER TABLE templates ADD COLUMN IF NOT EXISTS fixed_svg_url text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS fixed_svg_key text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS fixed_svg_asset_id uuid;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS template_kind varchar(20) NOT NULL DEFAULT 'banner';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS fixed_canvas_data jsonb;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS printable_area jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'templates_fixed_svg_asset_id_storage_assets_id_fk'
  ) THEN
    ALTER TABLE templates
      ADD CONSTRAINT templates_fixed_svg_asset_id_storage_assets_id_fk
      FOREIGN KEY (fixed_svg_asset_id) REFERENCES storage_assets(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS templates_kind_status_idx ON templates(template_kind, status);

-- Existing rectangular templates get an explicit full-canvas printable area.
UPDATE templates
SET printable_area = jsonb_build_object(
  'x', 0,
  'y', 0,
  'width', logical_canvas_width,
  'height', logical_canvas_height
)
WHERE printable_area IS NULL
  AND logical_canvas_width IS NOT NULL
  AND logical_canvas_height IS NOT NULL;

COMMIT;
