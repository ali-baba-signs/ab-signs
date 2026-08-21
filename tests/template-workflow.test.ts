import assert from 'node:assert/strict'
import test from 'node:test'
import { assertTransition, allowedTransitions, deadlineState, designDeadline } from '../lib/orders/workflow'
import { createReceiptPdf } from '../lib/pdf/receipt'
import { createTemplateCanvasSize } from '../lib/templates/size-conversion'
import { sanitizeSvgMarkup, validateFabricCanvasData } from '../lib/templates/svg-sanitization'
import { createUploadKey, validateUpload } from '../lib/storage/upload-validation'
import { validateProductInput } from '../lib/products/validation'
import { validateTemplateInput } from '../lib/templates/validation'
import { formatDimensions, parseMeasurement, sameMeasurement } from '../lib/measurements'
import { BANNER_SIZE_PRESETS } from '../lib/products/size-presets'

test('integer and decimal physical dimensions normalize without artificial .01 offsets', () => {
  for (const value of ['500','600','1000','1200','1500','500.125']) assert.equal(parseMeasurement(value).value, Number(value))
  assert.equal(sameMeasurement('500', '500.000'), true)
  assert.equal(formatDimensions('500','1000','mm'), '500 × 1000 mm')
  assert.equal(BANNER_SIZE_PRESETS.length, 20)
  assert.deepEqual(BANNER_SIZE_PRESETS[0], [500,1000])
})

test('fixed flag presets start with production dimensions but remain admin-editable', () => {
  const base = { sku:'FLAG-1',name:'Feather flag',description:'<p>A sufficiently detailed flag product.</p>',basePrice:50,categoryId:'d94ab2d1-f1ec-49d8-9d56-b5ba0694baa3',sizeMode:'fixed_variants',images:[{key:'products/flag.png'}] }
  assert.throws(()=>validateProductInput({...base,sizes:[{label:'Feather / Small / Double-sided',unit:'mm',unitPrice:80,enabled:true,variantType:'feather',sizeGroup:'small',sideMode:'double'}]}),/real print dimensions/i)
  const customized = validateProductInput({...base,sizes:[{label:'Custom small',height:'210',width:'55',unit:'cm',unitPrice:95,enabled:true,variantType:'feather',sizeGroup:'small',sideMode:'single'}]})
  assert.equal(customized.sizes[0].width, '55')
  assert.equal(customized.sizes[0].unitPrice, 95)
  const product=validateProductInput({...base,sizes:[{label:'Small – 2.6m',height:'200',width:'50',unit:'cm',unitPrice:80,enabled:true,variantType:'feather',sizeGroup:'small',sideMode:'double'}]})
  assert.equal(product.sizes[0].sideMode,'double')
  assert.equal(product.sizes[0].width,'50')
  assert.equal(product.sizes[0].height,'200')
  assert.equal(product.sizes[0].assembledHeightDescription,'Approximately 2.6 m assembled height')
})

test('template canvas mapping preserves physical aspect ratio without print-sized browser canvases', () => {
  const sixByThree = createTemplateCanvasSize(6, 3, 'ft')
  assert.equal(sixByThree.widthMm, 1828.8000000000002)
  assert.equal(sixByThree.logicalCanvasWidth, 1200)
  assert.equal(sixByThree.logicalCanvasHeight, 600)
  const portrait = createTemplateCanvasSize(600, 900, 'mm')
  assert.equal(portrait.logicalCanvasHeight, 1200)
  assert.equal(portrait.logicalCanvasWidth, 800)
})

test('SVG and Fabric validation reject executable, external, and empty template data', () => {
  assert.throws(() => sanitizeSvgMarkup('<svg><script>alert(1)</script></svg>'), /forbidden/i)
  assert.throws(() => sanitizeSvgMarkup('<svg><image href="https://evil.invalid/a.png"/></svg>'), /external/i)
  assert.equal(sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>').startsWith('<svg'), true)
  assert.throws(() => validateFabricCanvasData({ objects: [] }), /editable Fabric objects/i)
  assert.deepEqual(validateFabricCanvasData({ version: '7.4.0', objects: [{ type: 'rect' }] }).objects, [{ type: 'rect' }])
})

test('products own sizes and template input links category to product without duplicate sizes', () => {
  const product = validateProductInput({ sku: 'PRODUCT-1', name: 'Product owned sizes', description: '<p>A sufficiently detailed product description.</p>', basePrice: 25, categoryId: 'd94ab2d1-f1ec-49d8-9d56-b5ba0694baa3', templateId: 'a94ab2d1-f1ec-49d8-9d56-b5ba0694baa3', images: [{ key: 'products/a.webp', assetId: 'b94ab2d1-f1ec-49d8-9d56-b5ba0694baa3' }], sizes: [{ label: '500 × 1000 mm', width: 1000, height: 500, unit: 'mm', unitPrice: 30, enabled: true, isDefault: true }] })
  assert.equal(product.templateId, null)
  assert.equal(product.sizes.length, 1)
  const template = validateTemplateInput({ name: 'Product template', productId: 'a94ab2d1-f1ec-49d8-9d56-b5ba0694baa3', categoryId: 'd94ab2d1-f1ec-49d8-9d56-b5ba0694baa3', width: 1000, height: 500, unit: 'mm', status: 'active', assets: {}, canvasData: { objects: [{ type: 'rect' }] } })
  assert.deepEqual(template.productIds, ['a94ab2d1-f1ec-49d8-9d56-b5ba0694baa3'])
  assert.equal('sizes' in template, false)
})

test('order workflow accepts only configured transitions and computes the six-hour deadline', () => {
  assert.equal(assertTransition('pending_design_confirmation', 'design_confirmed'), 'design_confirmed')
  assert.throws(() => assertTransition('pending_design_confirmation', 'completed'), /cannot transition directly/i)
  assert.deepEqual(allowedTransitions('refunded'), [])
  const created = new Date('2026-08-06T00:00:00.000Z')
  assert.equal(designDeadline(created).toISOString(), '2026-08-06T06:00:00.000Z')
  assert.equal(deadlineState(created, new Date('2026-08-06T00:00:01.000Z')).delayed, true)
})

test('private design drafts and order PDFs use validated scoped R2 keys', () => {
  validateUpload({ filename: 'design-draft.json', contentType: 'application/json', size: 200, purpose: 'design-draft' })
  validateUpload({ filename: 'receipt.pdf', contentType: 'application/pdf', size: 200, purpose: 'order-document' })
  const draft = createUploadKey({ filename: 'design-draft.json', contentType: 'application/json', size: 200, purpose: 'design-draft' }, 'user-1')
  const receipt = createUploadKey({ filename: 'receipt.pdf', contentType: 'application/pdf', size: 200, purpose: 'order-document', destination: 'order-1' }, 'admin-1')
  assert.match(draft, /^uploads\/designs\/user-1\/drafts\/.+\.json$/)
  assert.match(receipt, /^orders\/order-1\/documents\/.+\.pdf$/)
})

test('server receipt generator emits a valid PDF structure', () => {
  const pdf = createReceiptPdf(['Alibaba Signs', 'PAYMENT RECEIPT', 'Order: ABS-TEST', 'Total: AUD 10.00'])
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4')
  assert.match(pdf.toString('binary'), /startxref/)
  assert.match(pdf.toString('binary'), /ABS-TEST/)
})
