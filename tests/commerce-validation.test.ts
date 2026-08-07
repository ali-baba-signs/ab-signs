import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeRichText } from '../lib/content/sanitize-html'
import { validateProductInput } from '../lib/products/validation'

test('rich text sanitization removes scripts, event handlers, and unsafe links', () => {
  const result = sanitizeRichText('<p onclick="steal()">Hello <strong>world</strong><script>alert(1)</script><a href="javascript:bad()">bad</a></p>')
  assert.equal(result.includes('script'), false)
  assert.equal(result.includes('onclick'), false)
  assert.equal(result.includes('javascript:'), false)
  assert.match(result, /<strong>world<\/strong>/)
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
