import pg from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
try {
  await client.query('begin')
  const category = await client.query("insert into product_categories(name,slug,description,category,enabled,show_on_homepage,display_order) values($1,$2,'Rollback-only CRUD verification','custom_banners',true,false,0) returning id", [`Verification category ${Date.now()}`, `verification-${Date.now()}-${crypto.randomUUID().slice(0,6)}`])
  await client.query('update product_categories set description=$1,updated_at=now() where id=$2',['Rollback-only category update verified.',category.rows[0].id])
  const admin = await client.query('select id, name from admin_users order by "createdAt" limit 1')
  const template = await client.query("insert into templates (name, description, canvas_data, category, status) values ('Commerce verification template', 'Temporary transaction-only record', '{}'::jsonb, 'templates', 'active') returning id")
  const product = await client.query("insert into products (category_id, template_id, sku, name, description, base_price, active) values ($1, $2, $3, 'Commerce verification product', '<p>Temporary verified product.</p>', 12.50, true) returning id", [category.rows[0].id, template.rows[0].id, `VERIFY-${Date.now()}`])
  const image = await client.query("insert into product_images (product_id, url, storage_key, alt, is_primary, \"order\") values ($1, 'https://invalid.local/verification.png', 'products/verification.png', 'Verification', true, 0) returning id", [product.rows[0].id])
  const size = await client.query("insert into product_sizes (product_id, label, width, height, unit, unit_price, enabled) values ($1, '600 x 900 mm', 600, 900, 'mm', 19.95, true) returning id", [product.rows[0].id])
  await client.query("insert into admin_activity_logs (admin_user_id, admin_name, action_type, entity_type, entity_id, entity_name, description) values ($1, $2, 'product.created', 'product', $3, 'Commerce verification product', 'Transaction-only verification activity.')", [admin.rows[0]?.id ?? null, admin.rows[0]?.name ?? 'Database verifier', product.rows[0].id])
  const order = await client.query("insert into orders (user_id, order_number, status, payment_status, payment_method, currency, customer_email, idempotency_key, total_amount, tax_amount, shipping_amount, shipping_address, billing_address) values (null, $1, 'pending', 'awaiting_payment', 'stripe', 'AUD', 'verification@invalid.local', $2, 21.95, 2.00, 0, '{}'::jsonb, '{}'::jsonb) returning id", [`VERIFY-${Date.now()}`, `verify_${crypto.randomUUID()}`])
  await client.query("insert into order_items (order_id, product_id, product_size_id, template_id, quantity, unit_price, total_price, specifications) values ($1, $2, $3, $4, 1, 19.95, 19.95, '{}'::jsonb)", [order.rows[0].id, product.rows[0].id, size.rows[0].id, template.rows[0].id])
  await client.query("insert into payment_records (order_id, provider, mode, status, amount, currency, external_id) values ($1, 'stripe', 'test', 'paid', 21.95, 'AUD', $2)", [order.rows[0].id, `test_${crypto.randomUUID()}`])
  await client.query("insert into contact_submissions (name, email, subject, message) values ('Verifier', 'verification@invalid.local', 'Schema check', 'Temporary transaction-only contact record.')")
  const joined = await client.query('select p.id, count(distinct pi.id)::int as images, count(distinct ps.id)::int as sizes from products p join product_images pi on pi.product_id=p.id join product_sizes ps on ps.product_id=p.id where p.id=$1 group by p.id', [product.rows[0].id])
  const payment = await client.query('select count(*)::int as count from payment_records where order_id=$1', [order.rows[0].id])
  if (joined.rows[0]?.images !== 1 || joined.rows[0]?.sizes !== 1 || payment.rows[0]?.count !== 1) throw new Error('Relational verification counts did not match.')
  const previewColumns = await client.query("select column_name from information_schema.columns where table_schema='public' and table_name='order_items' and column_name in ('preview_asset_id','front_preview_asset_id','back_preview_asset_id','customer_artwork_asset_id','production_asset_id')")
  if (previewColumns.rowCount !== 5) throw new Error('Persisted order-item preview columns are incomplete.')
  const promotion = await client.query("insert into homepage_promotions(internal_title,headline,description,image_url,cta_label,cta_url,alignment,enabled,display_order) values('Verifier','Dynamic promotion','Rollback-only homepage content','/verification.png','View','/products','image_left',true,9999) returning id")
  const promotionRead = await client.query('select headline from homepage_promotions where id=$1', [promotion.rows[0].id])
  if (promotionRead.rows[0]?.headline !== 'Dynamic promotion') throw new Error('Homepage promotion persistence failed.')
  const settingsPayload = { storeName: 'Ali Baba Signs', storeEmail: 'verification@invalid.local', storePhone: '0400000000', locations: [{ id: 'verify-location', name: 'Verification', address: 'Perth', enabled: true, displayOrder: 0 }], socialLinks: [{ id: 'verify-social', platform: 'whatsapp', url: 'https://wa.me/61400000000', enabled: true, displayOrder: 0 }] }
  await client.query("insert into store_settings(id,values,updated_by) values('verification',$1::jsonb,$2) on conflict(id) do update set values=excluded.values,updated_by=excluded.updated_by,updated_at=now()", [JSON.stringify(settingsPayload), admin.rows[0]?.id ?? null])
  const settingsRead = await client.query("select values from store_settings where id='verification'")
  if (settingsRead.rows[0]?.values?.socialLinks?.[0]?.platform !== 'whatsapp') throw new Error('Store settings JSON/social-link persistence failed.')
  await client.query('update products set name=$1, updated_at=now() where id=$2', ['Commerce verification product updated', product.rows[0].id])
  await client.query('delete from orders where id=$1', [order.rows[0].id])
  await client.query('delete from products where id=$1', [product.rows[0].id])
  await client.query('delete from templates where id=$1', [template.rows[0].id])
  await client.query('delete from product_categories where id=$1', [category.rows[0].id])
  console.log('Database commerce verification passed: commerce CRUD, persisted preview columns, dynamic promotions, social/contact settings JSON, orders, payments, and contact persistence.')
  await client.query('rollback')
} catch (error) {
  await client.query('rollback')
  console.error(`Database verification failed: ${error instanceof Error ? error.message : 'Unknown database error'}`)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
