import assert from 'node:assert/strict'
import test from 'node:test'
import { customArtworkPrice, customDimensions } from '../lib/products/custom-artwork'
import { allowedTransitions, isOrderStatus, ORDER_STATUS_LABELS } from '../lib/orders/workflow'

test('custom artwork area pricing converts supported units consistently', () => {
  assert.equal(customArtworkPrice(500, 500, 'mm', 100), 25)
  assert.equal(customArtworkPrice(50, 50, 'cm', 100), 25)
  assert.equal(customArtworkPrice(0.5, 0.5, 'mm', 100), 0)
  assert.equal(customDimensions(1, 1, 'ft').areaM2, 0.3048 ** 2)
})

test('custom dimensions reject missing, unsupported, and unreasonable values', () => {
  assert.throws(() => customDimensions('', 500, 'mm'))
  assert.throws(() => customDimensions(500, 500, 'px'))
  assert.throws(() => customDimensions(100000, 100000, 'ft'))
})

test('artwork review status is selectable and may move through confirmation', () => {
  assert.equal(isOrderStatus('artwork_pending'), true)
  assert.equal(ORDER_STATUS_LABELS.artwork_pending, 'Artwork Pending')
  assert.ok(allowedTransitions('pending_design_confirmation').includes('artwork_pending'))
  assert.ok(allowedTransitions('artwork_pending').includes('design_confirmed'))
})
