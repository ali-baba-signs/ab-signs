import assert from 'node:assert/strict'
import test from 'node:test'
import { designToSvg } from '../lib/production/design-svg'
import { nextProductSku, productSkuPrefix } from '../lib/products/sku'
import { DESIGN_UPLOAD_ERROR, validateUpload } from '../lib/storage/upload-validation'
import { orderMilestone, orderMilestoneLabel } from '../lib/orders/workflow'

test('canonical Fabric JSON exports as standalone SVG without a native canvas', () => {
  const svg = designToSvg({
    productConfig: { logicalCanvasWidth: 800, logicalCanvasHeight: 400 },
    canvasJson: { objects: [
      { type: 'rect', left: 10, top: 20, width: 200, height: 80, fill: '#ed1b68' },
      { type: 'textbox', left: 40, top: 50, width: 300, height: 50, text: 'Print <ready>', fontSize: 32, fill: '#fff' },
    ] },
  })
  assert.match(svg, /viewBox="0 0 800 400"/)
  assert.match(svg, /<rect/)
  assert.match(svg, /Print &lt;ready&gt;/)
  assert.doesNotMatch(svg, /<script/i)
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

test('customer design formats are strict and return the required message', () => {
  validateUpload({ filename: 'production.ai', contentType: 'application/vnd.adobe.illustrator', size: 500, purpose: 'design-artwork' })
  validateUpload({ filename: 'production.eps', contentType: 'application/postscript', size: 500, purpose: 'design-artwork' })
  assert.throws(() => validateUpload({ filename: 'movie.webm', contentType: 'video/webm', size: 500, purpose: 'design-artwork' }), new RegExp(DESIGN_UPLOAD_ERROR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('legacy operational statuses collapse into five customer milestones plus attention', () => {
  assert.equal(orderMilestone('quality_check'), 'production')
  assert.equal(orderMilestoneLabel('out_for_delivery'), 'Dispatch / Pickup')
  assert.equal(orderMilestone('refund_requested'), 'attention')
})
