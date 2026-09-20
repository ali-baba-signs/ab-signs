import assert from 'node:assert/strict'
import test from 'node:test'
import { bannerShippingForArea, calculateShipping } from '../lib/shipping/calculator'
import { DEFAULT_BANNER_SHIPPING_BANDS, validateShippingBands } from '../lib/shipping/bands'
import { checkoutTaxCents } from '../lib/cart/tax'
import { validateProductInput } from '../lib/products/validation'

const banner = { productId: 'banner', quantity: 1, width: 1000, height: 2000, unit: 'mm', isBanner: true }
const input = { deliveryType: 'delivery' as const, productSubtotal: 100, standardShippingCost: 12, freeShippingThreshold: 50, lines: [banner] }

test('banner tiers preserve defaults and boundary coverage without decimal gaps', () => {
  const bands = validateShippingBands(DEFAULT_BANNER_SHIPPING_BANDS)
  for (const [area, fee] of [[0,0],[2,15],[2.001,20],[5,20],[5.001,28],[10,28],[10.001,40],[20,40],[20.001,55]]) assert.equal(bannerShippingForArea(area, bands), fee)
  const legacy = bands.map(({maxAreaM2, price}) => ({maxAreaM2, price}))
  assert.deepEqual(validateShippingBands(legacy), bands)
})

test('tier changes flow through the existing shipping calculation', () => {
  const bands = validateShippingBands([{ minAreaM2: 0, maxAreaM2: 3, price: 9 }, { minAreaM2: 3, maxAreaM2: null, price: 22 }])
  assert.equal(calculateShipping({ ...input, bannerBands: bands }).amount, 9)
  assert.equal(calculateShipping({ ...input, bannerBands: bands, lines: [{ ...banner, quantity: 2 }] }).amount, 22)
})

test('tier validation rejects gaps, overlaps, negative fees, and missing final coverage', () => {
  for (const bands of [[], [{maxAreaM2:2,price:15}], [{minAreaM2:1,maxAreaM2:null,price:2}], [{maxAreaM2:null,price:-1}], [{maxAreaM2:2,price:15},{minAreaM2:2.1,maxAreaM2:null,price:20}], [{maxAreaM2:2,price:15},{minAreaM2:1,maxAreaM2:null,price:20}]]) assert.throws(() => validateShippingBands(bands))
})

test('free products, custom product fees, mixed carts and pickup retain clear precedence', () => {
  assert.equal(calculateShipping({ ...input, lines: [{ ...banner, freeShipping: true }] }).amount, 0)
  assert.equal(calculateShipping({ ...input, lines: [banner, { ...banner, productId: 'free', quantity: 100, freeShipping: true }] }).amount, 15)
  const custom = { ...banner, productId: 'custom', quantity: 5, customShippingAmount: 7.5 }
  assert.equal(calculateShipping({ ...input, lines: [banner, custom, { ...custom, quantity: 2 }] }).amount, 22.5)
  assert.equal(calculateShipping({ ...input, lines: [{ ...custom, customShippingAmount: 0 }] }).amount, 0)
  assert.equal(calculateShipping({ ...input, lines: [custom, { ...custom, productId: 'other' }] }).amount, 15)
  assert.equal(calculateShipping({ ...input, deliveryType: 'pickup', lines: [banner, custom] }).amount, 0)
  assert.equal(calculateShipping({ ...input, productSubtotal: 40, lines: [{ ...banner, isBanner: false }] }).amount, 12)
  assert.equal(calculateShipping({ ...input, productSubtotal: 50, lines: [{ ...banner, isBanner: false }] }).amount, 0)
})

test('tax follows product-only discount and shipping, responds to rate changes and disable', () => {
  const subtotal = 10000, discount = 2000, shipping = 1500
  assert.equal(checkoutTaxCents(subtotal - discount, shipping, true, 10), 950)
  assert.equal(subtotal - discount + shipping + checkoutTaxCents(subtotal - discount, shipping, true, 10), 10450)
  assert.equal(checkoutTaxCents(subtotal - discount, shipping, true, 5), 475)
  assert.equal(checkoutTaxCents(subtotal - discount, shipping, false, 10), 0)
  assert.equal(checkoutTaxCents(0, shipping, true, 10), 150)
  assert.equal(checkoutTaxCents(999, 0, true, 10), 100)
})

test('product shipping persists global, free and custom options with validated money', () => {
  const product = { sku:'SHIP-1',name:'Shipping product',description:'<p>A shipping configuration test product.</p>',basePrice:25,categoryId:'d94ab2d1-f1ec-49d8-9d56-b5ba0694baa3',images:[{key:'products/test.png'}],sizes:[{label:'Small',width:1000,height:500,unit:'mm',unitPrice:25,enabled:true}] }
  assert.equal(validateProductInput(product).customShippingAmount, null)
  assert.equal(validateProductInput({...product,customShippingAmount:7.5}).customShippingAmount, '7.50')
  assert.equal(validateProductInput({...product,freeShipping:true,customShippingAmount:7.5}).customShippingAmount, null)
  assert.throws(() => validateProductInput({...product,customShippingAmount:-1}), /non-negative/)
})
