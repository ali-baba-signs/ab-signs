import pg from 'pg'
import Stripe from 'stripe'

const baseUrl = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:3000'
if (!process.env.DATABASE_URL || !process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) throw new Error('DATABASE_URL and Stripe test credentials are required.')
if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) throw new Error('Verification refuses to run with a live Stripe key.')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const suffix = Date.now().toString(36).toUpperCase()
const couponCode = `SANDBOX_${suffix}`
const expiryCode = `EXPIRY_${suffix}`
const sessionExpiryCode = `SESSION_${suffix}`
let temporaryAdminId = null

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const payload = await response.json()
  if (!response.ok) throw new Error(`${path}: ${payload.error?.message || payload.error || response.statusText}`)
  return { response, payload }
}

async function fixture(code) {
  const result = await pool.query(`insert into coupons (code, description, discount_type, discount_value, active, usage_limit, used_count, reserved_count, visibility) values ($1, $2, 'percent', 20, true, 1, 0, 0, 'public') returning id, code`, [code, 'Automated Stripe sandbox verification coupon'])
  return result.rows[0]
}

async function adminFixture(code) {
  const email = `coupon-admin-${suffix.toLowerCase()}@example.com`
  const password = `Sandbox-${crypto.randomUUID()}-A1!`
  const signUp = await fetch(`${baseUrl}/api/admin-auth/sign-up/email`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ email, password, name: 'Coupon Sandbox Admin' }) })
  const signUpPayload = await signUp.json()
  if (!signUp.ok) throw new Error(`Temporary admin sign-up failed: ${signUpPayload.message || signUpPayload.error || signUp.statusText}`)
  temporaryAdminId = signUpPayload.user?.id || signUpPayload.data?.user?.id
  if (!temporaryAdminId) throw new Error('Temporary admin sign-up did not return a user id.')
  const setCookies = typeof signUp.headers.getSetCookie === 'function' ? signUp.headers.getSetCookie() : [signUp.headers.get('set-cookie') || '']
  const cookie = setCookies.map((value) => value.split(';')[0]).filter(Boolean).join('; ')
  const created = await fetch(`${baseUrl}/api/admin/coupons`, { method: 'POST', headers: { 'content-type': 'application/json', cookie, origin: baseUrl }, body: JSON.stringify({ code, description: 'Automated Stripe sandbox verification coupon', discountType: 'percent', discountValue: 20, active: true, usageLimit: 1, perCustomerUsageLimit: 1, visibility: 'public', productIds: [], categoryIds: [], customerIds: [] }) })
  const payload = await created.json()
  if (!created.ok) throw new Error(`Admin coupon creation failed: ${payload.error?.message || created.statusText}`)
  return payload.data.coupon
}

async function catalogueItem() {
  const legacy = await pool.query(`select p.id as product_id, ps.id as size_id from products p join product_sizes ps on ps.product_id=p.id and ps.enabled=true where p.active=true and ps.unit_price::numeric >= 1 order by p.created_at desc limit 1`)
  if (legacy.rows[0]) return legacy.rows[0]
  const templated = await pool.query(`select p.id as product_id, ts.id as size_id from products p join template_sizes ts on ts.template_id=p.template_id and ts.enabled=true join product_template_size_prices pp on pp.product_id=p.id and pp.template_size_id=ts.id and pp.enabled=true where p.active=true and pp.unit_price::numeric >= 1 order by p.created_at desc limit 1`)
  if (!templated.rows[0]) throw new Error('No active product with a payable enabled size is available.')
  return templated.rows[0]
}

function orderBody(item, code, token) {
  return { idempotencyKey: token, paymentMethod: 'stripe', deliveryType: 'pickup', policiesAccepted: true, couponCode: code, customer: { email: `stripe-sandbox-${suffix.toLowerCase()}@example.com`, phone: '0400000000' }, shippingAddress: { firstName: 'Stripe', lastName: 'Sandbox', address: '1 Test Street', city: 'Perth', state: 'WA', postalCode: '6000', country: 'Australia', phone: '0400000000' }, billingSameAsShipping: true, items: [{ productId: item.product_id, sizeId: item.size_id, designSource: 'design_assistance', quantity: 1, specifications: {} }] }
}

try {
  const item = await catalogueItem()
  const coupon = await adminFixture(couponCode)
  const apply = await request('/api/coupons/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: couponCode, items: [{ productId: item.product_id, sizeId: item.size_id, quantity: 1 }] }) })
  const checkoutToken = `sandbox_${crypto.randomUUID()}`
  const checkout = await request('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(orderBody(item, couponCode, checkoutToken)) })
  const { order, totals } = checkout.payload.data
  const intentResponse = await request('/api/payments/intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: order.id, checkoutToken }) })
  const intentId = intentResponse.payload.data.clientSecret.split('_secret_')[0]
  let intent = await stripe.paymentIntents.retrieve(intentId)
  const authoritativeAmount = Math.round(Number(totals.total) * 100)
  const intentAmountMatches = intent.amount === authoritativeAmount
  intent = await stripe.paymentIntents.confirm(intent.id, { payment_method: 'pm_card_visa', return_url: `${baseUrl}/order-success?order=${encodeURIComponent(order.orderNumber)}` })
  if (intent.status !== 'succeeded') throw new Error(`Stripe test payment did not succeed (status ${intent.status}).`)

  const event = { id: `evt_coupon_${suffix.toLowerCase()}`, object: 'event', api_version: null, created: Math.floor(Date.now() / 1000), data: { object: intent }, livemode: false, pending_webhooks: 1, request: { id: null, idempotency_key: null }, type: 'payment_intent.succeeded' }
  const webhookBody = JSON.stringify(event)
  const signature = stripe.webhooks.generateTestHeaderString({ payload: webhookBody, secret: process.env.STRIPE_WEBHOOK_SECRET })
  const firstWebhook = await fetch(`${baseUrl}/api/payments/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: webhookBody })
  const duplicateWebhook = await fetch(`${baseUrl}/api/payments/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: webhookBody })

  const [orderRecord, paymentRecord, redemptionRecord, couponRecord, reservationRecord] = await Promise.all([
    pool.query('select id, order_number, payment_status, status, total_amount, discount_amount, coupon_id from orders where id=$1', [order.id]),
    pool.query('select id, external_id, status, amount, mode from payment_records where order_id=$1', [order.id]),
    pool.query('select id, order_id, coupon_id, status, discount_amount from coupon_redemptions where order_id=$1', [order.id]),
    pool.query('select id, code, used_count, reserved_count, usage_limit from coupons where id=$1', [coupon.id]),
    pool.query('select id, order_id, status, expires_at, release_reason from coupon_reservations where order_id=$1', [order.id]),
  ])
  const paid = orderRecord.rows[0]?.payment_status === 'paid' && orderRecord.rows[0]?.status === 'payment_confirmed'
  const redeemedOnce = redemptionRecord.rowCount === 1 && couponRecord.rows[0]?.used_count === 1 && couponRecord.rows[0]?.reserved_count === 0

  const expiryCoupon = await fixture(expiryCode)
  const expiryToken = `expiry_${crypto.randomUUID()}`
  const expiryCheckout = await request('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(orderBody(item, expiryCode, expiryToken)) })
  const expiryOrderId = expiryCheckout.payload.data.order.id
  await pool.query(`update coupon_reservations set expires_at=now()-interval '1 minute' where order_id=$1`, [expiryOrderId])
  const cleanup = await request('/api/cron/coupon-reservations')
  const expiryRecords = await pool.query(`select c.used_count, c.reserved_count, r.status, r.release_reason, o.payment_status from coupons c join coupon_reservations r on r.coupon_id=c.id join orders o on o.id=r.order_id where c.id=$1`, [expiryCoupon.id])
  const released = expiryRecords.rows[0]?.reserved_count === 0 && expiryRecords.rows[0]?.status === 'released' && expiryRecords.rows[0]?.payment_status === 'cancelled'
  const availableAgain = Boolean((await request('/api/coupons/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: expiryCode, items: [{ productId: item.product_id, sizeId: item.size_id, quantity: 1 }] }) })).payload.data.coupon)

  const sessionCoupon = await fixture(sessionExpiryCode)
  const sessionToken = `session_${crypto.randomUUID()}`
  const sessionCheckout = await request('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(orderBody(item, sessionExpiryCode, sessionToken)) })
  const sessionOrderId = sessionCheckout.payload.data.order.id
  const sessionIntentResponse = await request('/api/payments/intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: sessionOrderId, checkoutToken: sessionToken }) })
  const sessionIntentId = sessionIntentResponse.payload.data.clientSecret.split('_secret_')[0]
  await pool.query(`update coupon_reservations set expires_at=now()-interval '1 minute' where order_id=$1`, [sessionOrderId])
  const sessionCleanup = await request('/api/cron/coupon-reservations')
  const canceledSessionIntent = await stripe.paymentIntents.retrieve(sessionIntentId)
  const sessionExpiryRecords = await pool.query(`select c.reserved_count, r.status, r.release_reason, o.payment_status from coupons c join coupon_reservations r on r.coupon_id=c.id join orders o on o.id=r.order_id where c.id=$1`, [sessionCoupon.id])
  const paymentSessionReleased = canceledSessionIntent.status === 'canceled' && sessionExpiryRecords.rows[0]?.reserved_count === 0 && sessionExpiryRecords.rows[0]?.status === 'released' && sessionExpiryRecords.rows[0]?.payment_status === 'cancelled'

  const checks = { publicLimitedCouponCreated: couponRecord.rows[0]?.usage_limit === 1, couponApplied: Number(apply.payload.data.coupon.discountCents) > 0, discountedIntentAmount: intentAmountMatches && authoritativeAmount < Math.round(Number(totals.subtotal) * 1.1 * 100), stripePaymentSucceeded: intent.status === 'succeeded', webhookAccepted: firstWebhook.ok, duplicateWebhookAccepted: duplicateWebhook.ok, orderMarkedPaid: paid, redemptionCreatedOnce: redeemedOnce, reservationConverted: reservationRecord.rows[0]?.status === 'redeemed', abandonedCheckoutReleased: released, releasedCouponAvailableAgain: availableAgain, expiredPaymentSessionCanceledAndReleased: paymentSessionReleased }
  console.log(JSON.stringify({ pass: Object.values(checks).every(Boolean), checks, records: { coupon: couponRecord.rows[0], order: orderRecord.rows[0], payment: paymentRecord.rows[0], redemption: redemptionRecord.rows, reservation: reservationRecord.rows[0], expiry: { couponId: expiryCoupon.id, orderId: expiryOrderId, cleanup: cleanup.payload.data, record: expiryRecords.rows[0] }, paymentSessionExpiry: { couponId: sessionCoupon.id, orderId: sessionOrderId, paymentIntentId: sessionIntentId, cleanup: sessionCleanup.payload.data, intentStatus: canceledSessionIntent.status, record: sessionExpiryRecords.rows[0] } }, stripe: { paymentIntentId: intent.id, amount: intent.amount, currency: intent.currency, status: intent.status, eventId: event.id, firstWebhookStatus: firstWebhook.status, duplicateWebhookStatus: duplicateWebhook.status } }, null, 2))
  if (!Object.values(checks).every(Boolean)) process.exitCode = 1
} finally {
  if (temporaryAdminId) await pool.query('delete from admin_users where id=$1', [temporaryAdminId])
  await pool.end()
}
