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
  assert.match(svg, /viewBox="0 0 822 422"/)
  assert.match(svg, /id="bleed-boundary"/)
  assert.match(svg, /id="cut-line"/)
  assert.match(svg, /id="safety-margin"/)
  assert.match(svg, /id="crop-marks"/)
  assert.match(svg, /<rect/)
  assert.match(svg, /Print &lt;ready&gt;/)
  assert.doesNotMatch(svg, /<script/i)
})

test('flag SVG production uses the fixed curved silhouette for bleed, cut, and safety contours', () => {
  const silhouette = { type: 'path', role: 'fixed-product-layer', width: 250, height: 1000, pathOffset: { x: 125, y: 500 }, path: [['M', 125, 0], ['C', 245, 80, 245, 500, 200, 700], ['L', 25, 1000], ['C', 5, 650, 0, 200, 125, 0], ['Z']], fill: '#fff' }
  const svg = designToSvg({
    productConfig: { widthMm: 500, heightMm: 2000, bleedMm: 3, safeMarginMm: 0, logicalCanvasWidth: 250, logicalCanvasHeight: 1000, productCategory: 'flag' },
    canvasJson: { objects: [silhouette, { type: 'textbox', left: 60, top: 250, width: 120, height: 100, text: 'FLAG ART', fill: '#ed1b68' }] },
  })
  assert.match(svg, /width="590mm" height="2090mm"/)
  assert.match(svg, /id="bleed-contour"/)
  assert.match(svg, /id="cut-contour"/)
  assert.match(svg, /id="safety-contour"/)
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
