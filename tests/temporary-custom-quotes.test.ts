import assert from 'node:assert/strict'
import test from 'node:test'
import { TEMPORARY_CUSTOM_QUOTE_IMAGE, TEMPORARY_CUSTOM_QUOTE_PRODUCTS, temporaryCustomQuoteProduct, temporaryCustomQuoteProductByName } from '../lib/products/temporary-custom-quotes'
import { validateUpload } from '../lib/storage/upload-validation'

test('temporary custom quote catalogue contains only the requested nine products', () => {
  assert.deepEqual(TEMPORARY_CUSTOM_QUOTE_PRODUCTS.map((product) => product.name), [
    'Table Cloths', 'Pull Up Banner', 'Shop Front Signs', '3D Signs', 'Grass Stakes',
    'A Frames', 'Business Cards', 'Flyers', 'Menus/Brochures',
  ])
  assert.equal(TEMPORARY_CUSTOM_QUOTE_IMAGE, 'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png')
  assert.equal(temporaryCustomQuoteProduct('custom-quote-3d-signs')?.name, '3D Signs')
  assert.equal(temporaryCustomQuoteProductByName('business cards')?.id, 'custom-quote-business-cards')
  assert.equal(temporaryCustomQuoteProduct('ordinary-database-product'), null)
})

test('custom quotation artwork uses the existing format and 100 MB validation', () => {
  const accepted = [
    ['artwork.pdf', 'application/pdf'], ['artwork.svg', 'image/svg+xml'], ['artwork.eps', 'application/postscript'],
    ['artwork.ai', 'application/vnd.adobe.illustrator'], ['artwork.png', 'image/png'],
  ] as const
  for (const [filename, contentType] of accepted) validateUpload({ filename, contentType, size: 100 * 1024 * 1024, purpose: 'design-artwork' })
  assert.throws(() => validateUpload({ filename: 'artwork.jpg', contentType: 'image/jpeg', size: 1, purpose: 'design-artwork' }), /supported formats/i)
  assert.throws(() => validateUpload({ filename: 'artwork.pdf', contentType: 'application/pdf', size: 100 * 1024 * 1024 + 1, purpose: 'design-artwork' }), /100 MB/i)
})
