import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanPlainText, normalizeAustralianPhone, phoneInputCharacters } from '../lib/validation/customer-input'

test('Australian phone validation rejects text and normalizes local and country formats', () => {
  assert.equal(normalizeAustralianPhone('0412 345 678', true), '+61412345678')
  assert.equal(normalizeAustralianPhone('+61 2 9876 5432', true), '+61298765432')
  assert.throws(() => normalizeAustralianPhone('call-me-now', true), /digits/)
  assert.throws(() => normalizeAustralianPhone('+1 212 555 0100', true), /Australian/)
  assert.equal(phoneInputCharacters(' +61 (412) abc-345-678 '), '+61412345678')
})

test('plain text cleaning removes control characters and enforces storage bounds', () => {
  assert.equal(cleanPlainText('  safe\u0000name  ', 20), 'safename')
  assert.equal(cleanPlainText('abcdefgh', 4), 'abcd')
})
