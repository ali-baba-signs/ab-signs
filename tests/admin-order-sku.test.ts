import assert from 'node:assert/strict'
import test from 'node:test'
import { adminOrderSku } from '../lib/orders/admin-sku'

const sku = 'FLG-TD-0001'

test('admin order SKU appends SS or DS from the actual order design type', () => {
  assert.equal(adminOrderSku({ specifications: { sku, designType: 'single_side' } }), `${sku}-SS`)
  assert.equal(adminOrderSku({ specifications: { sku, designType: 'double_side' } }), `${sku}-DS`)
})

test('order snapshot design type and SKU take precedence over legacy values and current product SKU', () => {
  const item = { specifications: { sku, designType: 'double_side', designMode: 'single_side', sideMode: 'single' }, product: { sku: 'CHANGED-SKU' } }
  assert.equal(adminOrderSku(item), `${sku}-DS`)
  assert.equal(item.specifications.sku, sku)
  assert.equal(item.product.sku, 'CHANGED-SKU')
})

test('admin SKU supports explicit legacy order design and selected-size snapshots', () => {
  assert.equal(adminOrderSku({ product: { sku }, specifications: { designMode: 'single_side', sideMode: 'double' } }), `${sku}-SS`)
  assert.equal(adminOrderSku({ product: { sku }, specifications: { sideMode: 'single' } }), `${sku}-SS`)
  assert.equal(adminOrderSku({ product: { sku }, specifications: { sideMode: 'double' } }), `${sku}-DS`)
})

test('historical orders without a known design type keep their original SKU', () => {
  assert.equal(adminOrderSku({ specifications: { sku } }), sku)
  assert.equal(adminOrderSku({ specifications: null, product: { sku } }), sku)
  assert.equal(adminOrderSku({ specifications: { sku, designType: 'unknown', sideMode: 'unknown', productName: 'Double-sided flag' } }), sku)
  assert.equal(adminOrderSku({ specifications: { designType: 'double_side' } }), '')
  assert.equal(adminOrderSku({ product: { sku: 'ORIGINAL-SS' } }), 'ORIGINAL-SS')
})

test('mixed single and double items with the same product SKU remain distinct in the SKU column', () => {
  const items = ['single_side', 'double_side', 'single_side'].map((designType) => ({ specifications: { sku, designType } }))
  const display = [...new Set(items.map(adminOrderSku).filter(Boolean))].join(', ')
  assert.equal(display, `${sku}-SS, ${sku}-DS`)
  assert.ok(display.toLowerCase().includes('flg-td-0001-ds'))
})
