import nextEnv from '@next/env'
import pg from 'pg'

nextEnv.loadEnvConfig(process.cwd())
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
try {
  await client.query('begin')
  const marker = crypto.randomUUID()
  const preview = await client.query("insert into storage_assets (object_key, filename, folder, content_type, size_bytes) values ($1, 'preview.webp', 'verification', 'image/webp', 10) returning id", [`verification/${marker}/preview.webp`])
  const svg = await client.query("insert into storage_assets (object_key, filename, folder, content_type, size_bytes) values ($1, 'source.svg', 'verification', 'image/svg+xml', 10) returning id", [`verification/${marker}/source.svg`])
  const category = await client.query("insert into product_categories (name, slug, category) values ($1, $2, 'custom_banners') returning id", [`Verification Category ${marker}`, `verification-${marker}`])
  await client.query('savepoint duplicate_category')
  let duplicateRejected = false
  try {
    await client.query("insert into product_categories (name, slug, category) values ($1, $2, 'custom_banners')", [`verification category ${marker}`.toUpperCase(), `different-${marker}`])
  } catch (error) {
    duplicateRejected = error?.code === '23505'
    await client.query('rollback to savepoint duplicate_category')
  }
  if (!duplicateRejected) throw new Error('Case-insensitive duplicate category was not rejected.')
  const template = await client.query("insert into templates (name, canvas_data, category, status, preview_image_key, preview_asset_id, svg_key, svg_asset_id, physical_width, physical_height, measurement_unit, logical_canvas_width, logical_canvas_height, scale_metadata) values ('Verification template', $1::jsonb, 'templates', 'active', $2, $3, $4, $5, 6, 3, 'ft', 1200, 600, $6::jsonb) returning id", [JSON.stringify({ version: '7.4.0', objects: [{ type: 'rect', width: 100, height: 50 }] }), `verification/${marker}/preview.webp`, preview.rows[0].id, `verification/${marker}/source.svg`, svg.rows[0].id, JSON.stringify({ pixelsPerMm: 0.656 })])
  const product = await client.query("insert into products (category_id, template_id, sku, name, description, base_price) values ($1, $2, $3, 'Verification product', '<p>Verification product description.</p>', 10) returning id", [category.rows[0].id, template.rows[0].id, `VERIFY-${marker}`])
  await client.query("insert into product_images (product_id, url, storage_key, asset_id, alt, is_primary) values ($1, $2, $3, $4, 'Verification preview', true)", [product.rows[0].id, 'https://invalid.local/preview.webp', `verification/${marker}/preview.webp`, preview.rows[0].id])
  await client.query("insert into product_sizes (product_id, label, width, height, unit, unit_price) values ($1, '6 × 3 ft', 6, 3, 'ft', 10)", [product.rows[0].id])
  await client.query("insert into hero_slides (desktop_asset_id, title, alt_text, horizontal_alignment, vertical_alignment, featured, enabled, display_order) values ($1, null, 'Image-only verification hero', 'center', 'bottom', true, true, 0)", [preview.rows[0].id])
  await client.query('savepoint referenced_asset')
  let referencedDeleteRejected = false
  let referencedDeleteCode = 'no-error'
  try { await client.query('delete from storage_assets where id = $1', [preview.rows[0].id]) }
  catch (error) { referencedDeleteCode = String(error?.code || error?.message || 'unknown'); referencedDeleteRejected = error?.code === '23503' || error?.code === '23001'; await client.query('rollback to savepoint referenced_asset') }
  if (!referencedDeleteRejected) {
    const constraints = await client.query("select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition from pg_constraint where confrelid = 'storage_assets'::regclass order by conrelid::regclass::text")
    throw new Error(`A referenced shared asset could be deleted or returned an unexpected error (${referencedDeleteCode}). Active references: ${JSON.stringify(constraints.rows)}`)
  }
  const joined = await client.query('select count(distinct p.id)::int products, count(distinct h.id)::int heroes, count(distinct t.id)::int templates from storage_assets a left join product_images pi on pi.asset_id=a.id left join products p on p.id=pi.product_id left join hero_slides h on h.desktop_asset_id=a.id or h.mobile_asset_id=a.id left join templates t on t.preview_asset_id=a.id or t.svg_asset_id=a.id where a.id in ($1,$2)', [preview.rows[0].id, svg.rows[0].id])
  if (joined.rows[0].products !== 1 || joined.rows[0].heroes !== 1 || joined.rows[0].templates !== 1) throw new Error('Asset relationship verification counts did not match.')
  console.log('Content database verification passed: custom category uniqueness, product/template/image/hero relationships, image-only hero, sizing metadata, generated canvas persistence, and referenced-asset delete protection.')
  await client.query('rollback')
} catch (error) {
  await client.query('rollback')
  console.error(`Content database verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
