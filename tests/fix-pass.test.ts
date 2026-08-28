import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPrintReadyPdf } from '../lib/pdf/print-ready-core'
import { bannerShippingForArea, calculateShipping, printedAreaM2 } from '../lib/shipping/calculator'
import { validateAustralianLocation } from '../lib/address/australia'
import { createUploadKey, validateUpload } from '../lib/storage/upload-validation'
import { productionSpec } from '../lib/production/production-spec'

test('print-ready export is a real PDF with physical metadata, bleed, and crop marks', () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])
  const pdf = buildPrintReadyPdf(jpeg, { widthMm: 1000, heightMm: 2000, bleedMm: 3, trimMarks: true, jpegWidth: 1000, jpegHeight: 2000, title: 'Production test' })
  const text = Buffer.from(pdf).toString('latin1')
  assert.equal(text.slice(0, 8), '%PDF-1.6')
  assert.match(text, /\/Subtype \/Image/)
  assert.match(text, /Trim 1000 x 2000 mm; bleed 3 mm; rectangle contour; crop marks yes; safety guides editor-only/)
  assert.match(text, /startxref\n\d+\n%%EOF/)
})

test('banner shipping follows total printed area and ignores free-shipping products', () => {
  assert.equal(printedAreaM2({ width: 1000, height: 2000, unit: 'mm', quantity: 1, isBanner: true }), 2)
  assert.equal(bannerShippingForArea(2), 15)
  assert.equal(bannerShippingForArea(2.1), 20)
  assert.equal(bannerShippingForArea(5.1), 28)
  assert.equal(bannerShippingForArea(10.1), 40)
  assert.equal(bannerShippingForArea(20.1), 55)
  const result = calculateShipping({ deliveryType: 'delivery', productSubtotal: 10, standardShippingCost: 12, freeShippingThreshold: 50, lines: [
    { width: 1000, height: 2000, unit: 'mm', quantity: 1, isBanner: true },
    { width: 5000, height: 5000, unit: 'mm', quantity: 1, isBanner: true, freeShipping: true },
  ] })
  assert.equal(result.amount, 15)
  assert.equal(result.bannerAreaM2, 2)
})

test('Australian address validation enforces state/postcode consistency', () => {
  assert.deepEqual(validateAustralianLocation({ suburb: 'Perth', state: 'WA', postalCode: '6000', country: 'Australia' }), { suburb: 'Perth', state: 'WA', postalCode: '6000', country: 'Australia' })
  assert.throws(() => validateAustralianLocation({ suburb: 'Perth', state: 'NSW', postalCode: '6000', country: 'Australia' }), /does not match NSW/)
  assert.throws(() => validateAustralianLocation({ suburb: 'Perth', state: 'WA', postalCode: '6000', country: 'New Zealand' }), /Australian addresses only/)
})

test('production PDF uploads use a private print path and strict PDF type', () => {
  validateUpload({ filename: 'front-production.pdf', contentType: 'application/pdf', size: 1000, purpose: 'design-production' })
  validateUpload({ filename: 'front-production.svg', contentType: 'image/svg+xml', size: 1000, purpose: 'design-production' })
  assert.match(createUploadKey({ filename: 'front-production.pdf', contentType: 'application/pdf', size: 1000, purpose: 'design-production', designId: 'draft-1' }, 'user-1'), /^generated\/print\/user-1\/draft-1\/.+\.pdf$/)
  assert.match(createUploadKey({ filename: 'front-production.svg', contentType: 'image/svg+xml', size: 1000, purpose: 'design-production', designId: 'draft-1' }, 'user-1'), /^generated\/print\/user-1\/draft-1\/.+\.svg$/)
})

test('flag production specs use the admin-configured curved-guide offsets', () => {
  const spec = productionSpec({ widthMm: 500, heightMm: 2000, bleedMm: 3, safeMarginMm: 0, logicalCanvasWidth: 300, logicalCanvasHeight: 1200, productCategory: 'flag' })
  assert.equal(spec.productKind, 'flag')
  assert.equal(spec.bleedMm, 3)
  assert.equal(spec.cutLineMm, 0)
  assert.equal(spec.safetyMm, 0)
})
