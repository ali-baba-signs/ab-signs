import test from 'node:test'
import assert from 'node:assert/strict'
import { captureAuthEmailDeliveryFailure, friendlyAuthEmailError, withAuthEmailDeliveryCapture } from '../lib/auth/email-delivery'

test('SMTP authentication failures produce a useful safe client error', () => {
  const failure = friendlyAuthEmailError('verification', Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' }))
  assert.equal(failure.code, 'EMAIL_DELIVERY_FAILED')
  assert.match(failure.message, /SMTP authentication failed/)
  assert.match(failure.message, /EAUTH\/AUTHPLAIN/)
  assert.doesNotMatch(failure.message, /Invalid login/)
})

test('verification delivery failures remain attached to the current auth request only', async () => {
  const first = await withAuthEmailDeliveryCapture(async () => {
    captureAuthEmailDeliveryFailure('verification', Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    return 'registration-response'
  })
  const second = await withAuthEmailDeliveryCapture(async () => 'another-response')
  assert.equal(first.value, 'registration-response')
  assert.match(first.failure?.message || '', /could not connect to SMTP/)
  assert.equal(second.failure, undefined)
})
