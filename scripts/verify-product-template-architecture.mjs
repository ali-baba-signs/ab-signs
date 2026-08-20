import pg from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required.')

const client = new pg.Client({ connectionString, ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false } })
const marker = `phase2-${Date.now()}`
const results = {}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

await client.connect()
try {
  await client.query('begin')
  const schema = await client.query(`
    select
      exists(select 1 from information_schema.columns where table_name='templates' and column_name='product_id') as template_product,
      exists(select 1 from information_schema.columns where table_name='product_sizes' and column_name='fit_mode') as size_config,
      exists(select 1 from pg_indexes where indexname='templates_status_product_idx') as compatibility_index
  `)
  assert(schema.rows[0].template_product && schema.rows[0].size_config && schema.rows[0].compatibility_index, 'Phase 2 migration is not applied.')

  const flagCategory = await client.query("insert into product_categories (name, slug, category, enabled) values ('Flags', $1, 'custom_banners', true) returning id, name", [`flags-${marker}`])
  const bannerCategory = await client.query("insert into product_categories (name, slug, category, enabled) values ('Banners', $1, 'custom_banners', true) returning id, name", [`banners-${marker}`])
  const feather = await client.query("insert into products (category_id, sku, name, description, base_price, size_mode, active) values ($1, $2, 'Feather Flag', 'Phase 2 verification product', 100, 'fixed_variants', true) returning id, name", [flagCategory.rows[0].id, `FLAG-${marker}`])
  const banner = await client.query("insert into products (category_id, sku, name, description, base_price, size_mode, active) values ($1, $2, 'Vinyl Banner', 'Phase 2 banner verification product', 80, 'preset_sizes', true) returning id, name", [bannerCategory.rows[0].id, `BANNER-${marker}`])

  const flagSizes = [
    ['Small – 2.6m', 50, 200, 'small', 'Approximately 2.6 m assembled height'],
    ['Medium – 3.4m', 60, 260, 'medium', 'Approximately 3.1 m assembled height'],
    ['Large – 4.5m', 70, 340, 'large', 'Approximately 4.1 m assembled height'],
    ['Extra Large – 5.5m', 80, 410, 'extra_large', 'Approximately 5.0 m assembled height'],
  ]
  for (const [label, width, height, sizeGroup, assembledHeight] of flagSizes) {
    await client.query('insert into product_sizes (product_id, label, width, height, unit, unit_price, enabled, sort_order, variant_type, size_group, side_mode, assembled_height_description, is_default) values ($1,$2,$3,$4,\'cm\',100,true,$5,\'feather\',$6,\'single\',$7,$8)', [feather.rows[0].id, label, width, height, flagSizes.findIndex((item) => item[0] === label), sizeGroup, assembledHeight, sizeGroup === 'small'])
  }
  for (const [order, height, width] of [[0, 500, 1000], [1, 600, 900], [2, 1000, 1500]]) {
    await client.query('insert into product_sizes (product_id, label, width, height, unit, unit_price, enabled, sort_order, is_default) values ($1,$2,$3,$4,\'mm\',80,true,$5,$6)', [banner.rows[0].id, `${height} × ${width} mm`, width, height, order, order === 0])
  }

  const flagTemplate = await client.query("insert into templates (product_id, name, description, preview_image_url, physical_width, physical_height, measurement_unit, logical_canvas_width, logical_canvas_height, canvas_data, conversion_status, status) values ($1, 'Feather Flag template', 'Verification template', 'https://example.invalid/flag.webp', 50, 200, 'cm', 300, 1200, $2::json, 'ready', 'active') returning id, product_id", [feather.rows[0].id, JSON.stringify({ version: '7.4.0', objects: [{ type: 'rect' }] })])
  const bannerTemplate = await client.query("insert into templates (product_id, name, description, preview_image_url, physical_width, physical_height, measurement_unit, logical_canvas_width, logical_canvas_height, canvas_data, conversion_status, status) values ($1, 'Vinyl Banner template', 'Verification template', 'https://example.invalid/banner.webp', 1000, 500, 'mm', 1200, 600, $2::json, 'ready', 'active') returning id, product_id", [banner.rows[0].id, JSON.stringify({ version: '7.4.0', objects: [{ type: 'rect' }] })])

  const inherited = await client.query('select ps.label, ps.width, ps.height, ps.unit from templates t join product_sizes ps on ps.product_id=t.product_id and ps.enabled where t.id=$1 order by ps.sort_order', [flagTemplate.rows[0].id])
  assert(inherited.rowCount === 4, 'Flag template did not inherit exactly four product sizes.')
  assert(inherited.rows.every((row, index) => row.label === flagSizes[index][0] && Number(row.width) === flagSizes[index][1] && Number(row.height) === flagSizes[index][2] && row.unit === 'cm'), 'Inherited flag dimensions do not match the required presets.')
  const duplicateSizes = await client.query('select count(*)::int as count from template_sizes where template_id in ($1,$2)', [flagTemplate.rows[0].id, bannerTemplate.rows[0].id])
  assert(duplicateSizes.rows[0].count === 0, 'New templates created duplicate template_sizes rows.')

  const flagCompatible = await client.query("select id, name from templates where status='active' and conversion_status='ready' and product_id=$1", [feather.rows[0].id])
  const bannerCompatible = await client.query("select id, name from templates where status='active' and conversion_status='ready' and product_id=$1", [banner.rows[0].id])
  assert(flagCompatible.rowCount === 1 && flagCompatible.rows[0].id === flagTemplate.rows[0].id, 'Flag filtering returned an unrelated template.')
  assert(bannerCompatible.rowCount === 1 && bannerCompatible.rows[0].id === bannerTemplate.rows[0].id, 'Banner filtering returned an unrelated template.')
  const bannerSizes = await client.query('select label from product_sizes where product_id=$1 and enabled order by sort_order', [banner.rows[0].id])
  assert(bannerSizes.rowCount === 3, 'Banner sizes were not served from the shared product size engine.')
  const derivedTaxonomy = await client.query('select pc.name as category, p.name as subcategory from templates t join products p on p.id=t.product_id join product_categories pc on pc.id=p.category_id where t.id=$1', [flagTemplate.rows[0].id])
  assert(derivedTaxonomy.rows[0].category === 'Flags' && derivedTaxonomy.rows[0].subcategory === 'Feather Flag', 'Template taxonomy was not derived from product/category.')

  const legacy = await client.query("select count(*)::int as remaining from products where size_mode='template_sizes'")
  assert(legacy.rows[0].remaining === 0, 'Legacy template_sizes products remain after migration.')
  results.schema = schema.rows[0]
  results.admin = { category: flagCategory.rows[0].name, product: feather.rows[0].name, sizes: inherited.rows, template: 'Feather Flag template', duplicateTemplateSizeRows: duplicateSizes.rows[0].count }
  results.customer = { flagSizes: inherited.rows.map((row) => row.label), bannerSizes: bannerSizes.rows.map((row) => row.label), flagTemplates: flagCompatible.rows.map((row) => row.name), bannerTemplates: bannerCompatible.rows.map((row) => row.name) }
  results.taxonomy = derivedTaxonomy.rows[0]
  results.legacyTemplateSizeProducts = legacy.rows[0].remaining
  console.log(JSON.stringify({ pass: true, ...results }, null, 2))
  await client.query('rollback')
} catch (error) {
  await client.query('rollback').catch(() => undefined)
  console.error(JSON.stringify({ pass: false, error: error instanceof Error ? error.message : String(error), ...results }, null, 2))
  process.exitCode = 1
} finally {
  await client.end()
}
