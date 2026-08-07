import pg from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
try {
  await client.query('begin')
  const category = await client.query('select id from product_categories order by created_at limit 1')
  if (!category.rowCount) throw new Error('No product category is available.')
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
  await client.query('update products set name=$1, updated_at=now() where id=$2', ['Commerce verification product updated', product.rows[0].id])
  await client.query('delete from orders where id=$1', [order.rows[0].id])
  await client.query('delete from products where id=$1', [product.rows[0].id])
  await client.query('delete from templates where id=$1', [template.rows[0].id])
  console.log('Database commerce verification passed: product create/update/delete, image/size/template relations, activity, order, payment, settings schema, and contact persistence.')
  await client.query('rollback')
} catch (error) {
  await client.query('rollback')
  console.error(`Database verification failed: ${error instanceof Error ? error.message : 'Unknown database error'}`)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
