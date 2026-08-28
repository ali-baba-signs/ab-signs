import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeRichText } from '../lib/content/sanitize-html'
import { validateProductInput } from '../lib/products/validation'
import { authoritativeTotalCents, stripeEventPaymentStatus } from '../lib/payments/integrity'
import { removePurchasedCartLines } from '../lib/cart/checkout-removal'

test('rich text sanitization removes scripts, event handlers, and unsafe links', () => {
  const result = sanitizeRichText('<p onclick="steal()">Hello <strong>world</strong><script>alert(1)</script><a href="javascript:bad()">bad</a></p>')
  assert.equal(result.includes('script'), false)
  assert.equal(result.includes('onclick'), false)
  assert.equal(result.includes('javascript:'), false)
  assert.match(result, /<strong>world<\/strong>/)
})

test('product description bullet lists survive validation and storage sanitization', () => {
  const product = validateProductInput({
    sku: 'BULLET-1', name: 'Bullet product', description: '<p>Production details:</p><ul><li>Outdoor rated</li><li>Full colour print</li><li>Finished edges</li></ul>', basePrice: 25,
    categoryId: 'd94ab2d1-f1ec-49d8-9d56-b5ba0694baa3',
    images: [{ key: 'products/bullet.png', isPrimary: true }],
    sizes: [{ label: '600 × 900', width: 600, height: 900, unit: 'mm', unitPrice: 25, enabled: true }],
  })
  assert.match(product.description, /<ul><li>Outdoor rated<\/li><li>Full colour print<\/li><li>Finished edges<\/li><\/ul>/)
})

test('product validation requires a persisted image and an enabled size', () => {
  assert.throws(() => validateProductInput({
    sku: 'VALID-1', name: 'Valid product', description: '<p>A sufficiently long description.</p>',
    basePrice: 10, categoryId: 'd94ab2d1-f1ec-49d8-9d56-b5ba0694baa3', images: [], sizes: [],
  }), /image/i)
})

test('product validation normalizes prices and limits primary image to one', () => {
  const product = validateProductInput({
    sku: 'sample-1', name: 'Sample product', description: '<p>A sufficiently long description.</p>', basePrice: '12.345',
    categoryId: 'd94ab2d1-f1ec-49d8-9d56-b5ba0694baa3',
    images: [{ key: 'products/a.png', isPrimary: true }, { key: 'products/b.png', isPrimary: true }],
    sizes: [{ label: '600 × 900', width: 600, height: 900, unit: 'mm', unitPrice: '19.999', enabled: true }],
  })
  assert.equal(product.sku, 'SAMPLE-1')
  assert.equal(product.basePrice, 12.35)
  assert.equal(product.sizes[0].unitPrice, 20)
  assert.equal(product.images.filter((image) => image.isPrimary).length, 1)
})

test('authoritative payment totals reject drift and map Stripe outcomes explicitly', () => {
  assert.equal(authoritativeTotalCents({ itemTotals: ['100.00', '25.00'], discount: '10.00', shipping: '8.00', tax: '12.30', total: '135.30' }), 13530)
  assert.throws(() => authoritativeTotalCents({ itemTotals: ['100.00'], discount: '0', shipping: '0', tax: '10', total: '109.99' }), /inconsistent/i)
  assert.equal(stripeEventPaymentStatus('payment_intent.succeeded'), 'paid')
  assert.equal(stripeEventPaymentStatus('payment_intent.payment_failed'), 'payment_failed')
  assert.equal(stripeEventPaymentStatus('payment_intent.processing'), 'processing')
})

test('verified checkout removes only purchased cart quantities', () => {
  const remaining = removePurchasedCartLines([
    { lineId: 'purchased', quantity: 2, name: 'Purchased product' },
    { lineId: 'partially-purchased', quantity: 5, name: 'Additional quantity' },
    { lineId: 'new-item', quantity: 1, name: 'Added after checkout' },
  ], [
    { lineId: 'purchased', quantity: 2 },
    { lineId: 'partially-purchased', quantity: 3 },
  ])

  assert.deepEqual(remaining, [
    { lineId: 'partially-purchased', quantity: 2, name: 'Additional quantity' },
    { lineId: 'new-item', quantity: 1, name: 'Added after checkout' },
  ])
})
