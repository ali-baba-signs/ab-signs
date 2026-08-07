import pg from 'pg'

const baseURL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3101'
const createdOrderIds = []
let temporaryProductId = null
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function json(path, init) {
  const response = await fetch(`${baseURL}${path}`, init)
  const payload = await response.json()
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${payload.error?.message || 'Unknown error'}`)
  return payload.data
}

try {
  const [{ products }, settings] = await Promise.all([json('/api/products'), json('/api/store/settings')])
  let product = products.find((item) => item.sizes?.length)
  if (!product) {
    const category = await pool.query('select id from product_categories order by created_at limit 1')
    if (!category.rowCount) throw new Error('No product category is available for checkout verification.')
    const insertedProduct = await pool.query("insert into products (category_id, sku, name, description, base_price, active) values ($1, $2, 'Checkout smoke product', '<p>Temporary checkout verification product.</p>', 10, true) returning id, name", [category.rows[0].id, `CHECKOUT-${Date.now()}`])
    temporaryProductId = insertedProduct.rows[0].id
    const insertedSize = await pool.query("insert into product_sizes (product_id, label, unit, unit_price, enabled) values ($1, 'Smoke size', 'mm', 19.95, true) returning id, label, unit_price", [temporaryProductId])
    product = { ...insertedProduct.rows[0], template: null, sizes: [{ id: insertedSize.rows[0].id, label: insertedSize.rows[0].label, unitPrice: insertedSize.rows[0].unit_price }] }
  }
  const size = product.sizes[0]
  const expectedSubtotal = Number(size.unitPrice) * 2
  const expectedShipping = expectedSubtotal >= settings.freeShippingThreshold ? 0 : settings.shippingCost
  const expectedTotal = expectedSubtotal + expectedSubtotal * settings.taxRate / 100 + expectedShipping
  const scenarios = [
    { provider: 'stripe', outcome: 'success', expected: 'paid' },
    { provider: 'paypal', outcome: 'failure', expected: 'payment_failed' },
    { provider: 'card', outcome: 'cancel', expected: 'cancelled' },
  ]
  for (const scenario of scenarios) {
    const checkoutToken = `smoke_${crypto.randomUUID()}`
    const address = { firstName: 'Checkout', lastName: 'Verifier', address: '1 Test Street', city: 'Melbourne', state: 'VIC', postalCode: '3000', country: 'Australia', phone: '0400000000' }
    const orderData = await json('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      idempotencyKey: checkoutToken, paymentMethod: scenario.provider, customer: { email: 'checkout-verifier@invalid.local' }, shippingAddress: address,
      billingSameAsShipping: true, items: [{ productId: product.id, sizeId: size.id, templateId: product.template?.id || null, quantity: 2, price: 0, total: 0 }],
    }) })
    createdOrderIds.push(orderData.order.id)
    if (Math.abs(Number(orderData.order.totalAmount) - expectedTotal) > 0.011 || Number(orderData.order.totalAmount) === 0) throw new Error('Server total did not match persisted size pricing.')
    const duplicate = await json('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: checkoutToken, paymentMethod: scenario.provider, customer: { email: 'checkout-verifier@invalid.local' }, shippingAddress: address, billingSameAsShipping: true, items: [{ productId: product.id, sizeId: size.id, quantity: 99 }] }) })
    if (!duplicate.duplicate || duplicate.order.id !== orderData.order.id) throw new Error('Idempotent order retry created a duplicate.')
    const payment = await json('/api/payments/attempt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: orderData.order.id, checkoutToken, provider: scenario.provider, outcome: scenario.outcome }) })
    if (payment.order.paymentStatus !== scenario.expected) throw new Error(`${scenario.provider} ${scenario.outcome} produced ${payment.order.paymentStatus}.`)
  }
  console.log('Checkout HTTP smoke passed: server-priced totals resist client price manipulation, idempotent order creation, Stripe success, PayPal failure, and card cancellation.')
} catch (error) {
  console.error(`Checkout smoke failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exitCode = 1
} finally {
  if (createdOrderIds.length) await pool.query('delete from orders where id = any($1::uuid[])', [createdOrderIds])
  if (temporaryProductId) await pool.query('delete from products where id = $1', [temporaryProductId])
  await pool.end()
}
