import assert from 'node:assert/strict'
import { DEFAULT_STORE_SETTINGS, validateStoreSettings } from '../lib/store/settings'
import { calculateShipping } from '../lib/shipping/calculator'
import { checkoutTaxCents } from '../lib/cart/tax'

const changed = validateStoreSettings({ ...DEFAULT_STORE_SETTINGS, taxEnabled: true, taxName: 'Sales tax', taxRate: '5', bannerShippingBands: [{ minAreaM2: 0, maxAreaM2: 3, price: 9 }, { minAreaM2: 3, maxAreaM2: null, price: 22 }] })
const persisted = JSON.parse(JSON.stringify(changed))
assert.equal(persisted.taxName, 'Sales tax')
const shipping = calculateShipping({ deliveryType: 'delivery', lines: [{productId:'test',quantity:1,width:1000,height:2000,unit:'mm',isBanner:true}],productSubtotal:80,standardShippingCost:persisted.shippingCost,freeShippingThreshold:persisted.freeShippingThreshold,bannerBands:persisted.bannerShippingBands })
assert.equal(shipping.amount, 9)
assert.equal(checkoutTaxCents(8000,900,persisted.taxEnabled,persisted.taxRate),445)
assert.equal(checkoutTaxCents(8000,900,validateStoreSettings({...changed,taxEnabled:false}).taxEnabled,5),0)
assert.throws(() => validateStoreSettings({...changed,taxRate:101}),/Tax rate/)
assert.throws(() => validateStoreSettings({...changed,taxName:''}),/required/)
assert.throws(() => validateStoreSettings({...changed,bannerShippingBands:[{maxAreaM2:2,price:15}]}),/final/)
console.log('PASS: admin settings validation, JSON round-trip, changed shipping tiers, changed tax rate/name, and disabled tax.')
