import assert from 'node:assert/strict'
import test from 'node:test'
import { safeCallbackUrl } from '../lib/auth/callback-url'

test('authentication return URLs keep local design state and reject external destinations', () => {
  const destination = '/design?productId=product-1&sizeId=size-2&designType=double_side&quantity=3'
  assert.equal(safeCallbackUrl(destination), destination)
  assert.equal(safeCallbackUrl('/products/product-1?uploadArtwork=1&quantity=3'), '/products/product-1?uploadArtwork=1&quantity=3')
  assert.equal(safeCallbackUrl('//other.example/design'), '/')
  assert.equal(safeCallbackUrl('https://other.example/design'), '/')
})
