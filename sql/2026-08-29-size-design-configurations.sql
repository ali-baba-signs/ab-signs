-- Size-based design options. Product design_mode and the legacy size-side
-- columns remain temporarily for compatibility, but are no longer authoritative.
ALTER TABLE product_sizes
  ADD COLUMN IF NOT EXISTS design_configurations json NOT NULL DEFAULT '[]'::json;

UPDATE product_sizes ps
SET design_configurations = CASE
  WHEN ps.side_mode = 'double' THEN json_build_array(json_build_object(
    'designType', 'double_side',
    'enabled', true,
    'frontTemplateId', ps.front_template_id,
    'backTemplateId', ps.back_template_id
  ))
  ELSE json_build_array(json_build_object(
    'designType', 'single_side',
    'enabled', true,
    'singleTemplateId', coalesce(ps.front_template_id, p.template_id)
  ))
END
FROM products p
WHERE p.id = ps.product_id
  AND (ps.design_configurations IS NULL OR ps.design_configurations::jsonb = '[]'::jsonb);
