import assert from 'node:assert/strict'
import test from 'node:test'
import { designToSvg } from '../lib/production/design-svg'
import { nextProductSku, productSkuPrefix } from '../lib/products/sku'
import { productWriteErrorMessage } from '../lib/products/write-errors'
import { DESIGN_UPLOAD_ERROR, validateUpload } from '../lib/storage/upload-validation'
import { canvasUploadFingerprint, canvasUploadFolder, collectCanvasUploadKeys, friendlyCanvasUploadError, validateCanvasImageSignature } from '../lib/storage/canvas-uploads'
import { orderMilestone, orderMilestoneLabel } from '../lib/orders/workflow'

test('canonical Fabric JSON exports as standalone SVG without a native canvas', () => {
  const svg = designToSvg({
    productConfig: { logicalCanvasWidth: 800, logicalCanvasHeight: 400 },
    canvasJson: { objects: [
      { type: 'rect', left: 10, top: 20, width: 200, height: 80, fill: '#ed1b68' },
      { type: 'textbox', left: 40, top: 50, width: 300, height: 50, text: 'Print <ready>', fontSize: 32, fill: '#fff' },
    ] },
  })
  assert.match(svg, /viewBox="0 0 822 422"/)
  assert.match(svg, /id="bleed-boundary"/)
  assert.match(svg, /id="cut-line"/)
  assert.doesNotMatch(svg, /id="safety-margin"/)
  assert.doesNotMatch(svg, /production-safety/)
  assert.match(svg, /id="crop-marks"/)
  assert.match(svg, /<rect/)
  assert.match(svg, /Print &lt;ready&gt;/)
  assert.doesNotMatch(svg, /<script/i)
})

test('flag SVG production uses the fixed curved silhouette for bleed and cut while safety remains editor-only', () => {
  const silhouette = { type: 'path', role: 'fixed-product-layer', width: 250, height: 1000, pathOffset: { x: 125, y: 500 }, path: [['M', 125, 0], ['C', 245, 80, 245, 500, 200, 700], ['L', 25, 1000], ['C', 5, 650, 0, 200, 125, 0], ['Z']], fill: '#fff' }
  const svg = designToSvg({
    productConfig: { widthMm: 500, heightMm: 2000, bleedMm: 3, safeMarginMm: 0, logicalCanvasWidth: 250, logicalCanvasHeight: 1000, productCategory: 'flag' },
    canvasJson: { objects: [silhouette, { type: 'textbox', left: 60, top: 250, width: 120, height: 100, text: 'FLAG ART', fill: '#ed1b68' }] },
  })
  assert.match(svg, /width="522mm" height="2022mm"/)
  assert.match(svg, /id="bleed-contour"/)
  assert.match(svg, /id="cut-contour"/)
  assert.doesNotMatch(svg, /id="safety-contour"/)
  assert.match(svg, /mask="url\(#production-flag-mask\)"/)
  assert.doesNotMatch(svg, /id="cut-line"/)
})

test('double-sided canonical data selects the requested side', () => {
  const svg = designToSvg({ productConfig: { logicalCanvasWidth: 100, logicalCanvasHeight: 50 }, sides: { front: { canvasJson: { objects: [{ type: 'text', text: 'FRONT', width: 50, height: 20 }] } }, back: { canvasJson: { objects: [{ type: 'text', text: 'BACK', width: 50, height: 20 }] } } } }, 'back')
  assert.match(svg, /BACK/)
  assert.doesNotMatch(svg, /FRONT/)
})

test('new product SKUs are short, readable, and sequential', () => {
  const prefix = productSkuPrefix('Vinyl Banners', 'Premium Outdoor Banner')
  assert.equal(prefix, 'VIN-PO')
  assert.equal(nextProductSku(prefix, ['VIN-PO-0001', 'VIN-PO-0008', 'OLD-LONG-SKU']), 'VIN-PO-0009')
})

test('product write errors distinguish SKU collisions from other validation failures', () => {
  const duplicateSku = Object.assign(new Error('Database query failed'), {
    cause: { code: '23505', constraint: 'products_sku_unique', detail: 'Key (sku)=(VIN-PO-0001) already exists.' },
  })

  assert.match(productWriteErrorMessage(duplicateSku, 'created'), /SKU is already in use/i)
  assert.equal(
    productWriteErrorMessage(new Error('1000 × 1000 mm requires a single template for its Single Side option.'), 'created'),
    '1000 × 1000 mm requires a single template for its Single Side option.',
  )
  assert.equal(
    productWriteErrorMessage(new Error('Database query failed'), 'created'),
    'The product could not be created. Review the product details and try again.',
  )
})

test('customer design formats are strict and return the required message', () => {
  validateUpload({ filename: 'production.ai', contentType: 'application/vnd.adobe.illustrator', size: 500, purpose: 'design-artwork' })
  validateUpload({ filename: 'production.eps', contentType: 'application/postscript', size: 500, purpose: 'design-artwork' })
  assert.throws(() => validateUpload({ filename: 'movie.webm', contentType: 'video/webm', size: 500, purpose: 'design-artwork' }), new RegExp(DESIGN_UPLOAD_ERROR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('canvas image uploads accept only matching image formats up to 10 MB', () => {
  for (const [filename, contentType] of [
    ['logo.png', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['graphic.webp', 'image/webp'],
    ['mark.svg', 'image/svg+xml'],
  ]) validateUpload({ filename, contentType, size: 10 * 1024 * 1024, purpose: 'logo' })

  assert.throws(
    () => validateUpload({ filename: 'logo.gif', contentType: 'image/gif', size: 100, purpose: 'logo' }),
    /Unsupported file type\. Please upload PNG, JPEG, WEBP, or SVG files only\./,
  )
  assert.throws(
    () => validateUpload({ filename: 'logo.png', contentType: 'image/jpeg', size: 100, purpose: 'logo' }),
    /Unsupported file type\. Please upload PNG, JPEG, WEBP, or SVG files only\./,
  )
  assert.throws(
    () => validateUpload({ filename: 'logo.png', contentType: 'image/png', size: 10 * 1024 * 1024 + 1, purpose: 'logo' }),
    /File size exceeds 10 MB limit\./,
  )
})

test('canvas upload session helpers deduplicate files, preserve used keys, and hide fetch errors', () => {
  const file = { name: 'Logo.PNG', size: 1234, type: 'image/png', lastModified: 99 }
  assert.equal(canvasUploadFingerprint(file), canvasUploadFingerprint({ ...file }))
  assert.notEqual(canvasUploadFingerprint(file), canvasUploadFingerprint({ ...file, size: 1235 }))
  const used = collectCanvasUploadKeys({ objects: [{ assetKey: 'uploads/users/customer/temporary/logo.png' }, { assetKey: 'products/public.webp' }], back: { objects: [{ assetKey: 'uploads/users/customer/temporary/back.svg' }] } })
  assert.deepEqual([...used].sort(), ['uploads/users/customer/temporary/back.svg', 'uploads/users/customer/temporary/logo.png'])
  assert.equal(friendlyCanvasUploadError(new TypeError('Failed to fetch')), 'Upload failed. Try again.')
  assert.equal(friendlyCanvasUploadError({ name: 'AbortError' }), 'Upload timed out. Try again.')
  assert.equal(canvasUploadFolder('customer/../1'), 'uploads/users/customer1/temporary/canvas')
  assert.equal(friendlyCanvasUploadError(new Error('SVG contains an unsafe or external reference.')), 'This SVG cannot be used safely. Export it as a self-contained SVG or upload PNG instead.')
})

test('canvas image signatures reject renamed files and accept PNG, JPEG, and WEBP headers', () => {
  validateCanvasImageSignature('image/png', Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))
  validateCanvasImageSignature('image/jpeg', Uint8Array.from([255, 216, 255, 224]))
  validateCanvasImageSignature('image/webp', new TextEncoder().encode('RIFF1234WEBP'))
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.throws(() => validateCanvasImageSignature(type, new TextEncoder().encode('<html>Not an image</html>')), /Unsupported file type/)
    assert.throws(() => validateCanvasImageSignature(type, new Uint8Array()), /Unsupported file type/)
  }
})

test('legacy operational statuses collapse into five customer milestones plus attention', () => {
  assert.equal(orderMilestone('quality_check'), 'production')
  assert.equal(orderMilestoneLabel('out_for_delivery'), 'Dispatch / Pickup')
  assert.equal(orderMilestone('refund_requested'), 'attention')
})
