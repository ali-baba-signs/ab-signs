import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SUPPORT_SETTINGS as defaults, supportAvailability, validateSupportSettings } from '../lib/support/settings'
import { validateSupportMessage } from '../lib/support/validation'
import { supportWebhookUrl, validSupportSecret } from '../lib/support/security'
import { boundedSupportBody } from '../lib/support/request-body'

const message = { customerName: 'Test Customer', customerEmail: 'CUSTOMER@example.com', category: 'General enquiry', message: 'Please help with my signage.', pageUrl: 'https://alibabasigns.com.au/contact?token=private#details' }

test('support respects Melbourne opening boundaries, weekends and daylight saving', () => {
  for (const [time, expected] of [
    ['2026-09-20T22:59:00Z', false], ['2026-09-20T23:00:00Z', true],
    ['2026-09-21T06:59:00Z', true], ['2026-09-21T07:00:00Z', false],
    ['2026-09-19T02:00:00Z', false], ['2026-12-06T22:00:00Z', true],
  ] as const) assert.equal(supportAvailability(defaults, new Date(time)).isBusinessHours, expected, time)
  assert.equal(supportAvailability(defaults, new Date('2026-09-19T02:00:00Z')).response, defaults.afterHoursResponse)
})

test('overnight hours carry through to the following day; disabled hours use normal acknowledgement', () => {
  const settings = { ...defaults, openingDays: [5], openingTime: '22:00', closingTime: '02:00' }
  assert.equal(supportAvailability(settings, new Date('2026-09-18T15:00:00Z')).isBusinessHours, true)
  assert.equal(supportAvailability(settings, new Date('2026-09-18T16:00:00Z')).isBusinessHours, false)
  assert.equal(supportAvailability({ ...defaults, businessHoursEnabled: false }, new Date('2026-09-19T02:00:00Z')).response, defaults.businessHoursResponse)
})

test('admin notification addresses normalize, deduplicate and validate', () => {
  assert.deepEqual(validateSupportSettings({ ...defaults, notificationEmails: [' Team@example.com ', 'team@example.com'] }).notificationEmails, ['team@example.com'])
  for (const input of [{ timezone: 'Invalid/Place' }, { openingDays: [] }, { openingTime: '25:00' }, { notificationEmails: ['bad'] }, { webhookUrl: 'http://localhost/hook' }]) {
    assert.throws(() => validateSupportSettings({ ...defaults, ...input }))
  }
})

test('support inputs normalize email and strip private URL parameters', () => {
  const result = validateSupportMessage(message)
  assert.equal(result.customerEmail, 'customer@example.com')
  assert.equal(result.pageUrl, 'https://alibabasigns.com.au/contact')
  assert.equal(result.source, 'Website')
  for (const input of [{ customerEmail: 'bad' }, { message: 'short' }, { message: 'x'.repeat(5001) }, { category: 'Unknown' }, { category: 'Order status' }, { pageUrl: 'javascript:alert(1)' }]) assert.throws(() => validateSupportMessage({ ...message, ...input }))
})

test('custom quotes require product, size and quantity with a real calendar date', () => {
  const quote = { ...message, category: 'Custom quote', product: 'Banner', size: '2 x 1 m', quantity: 3, requiredDate: '2026-10-12' }
  assert.equal(validateSupportMessage(quote).quote?.quantity, 3)
  for (const input of [{ product: '' }, { size: '' }, { quantity: 0 }, { quantity: 1.5 }, { requiredDate: '2026-02-30' }]) assert.throws(() => validateSupportMessage({ ...quote, ...input }))
})

test('webhooks require an allowlisted HTTPS host and strong exact secret', () => {
  assert.equal(supportWebhookUrl('', {}), 'https://automation.alibabasigns.com.au/webhook/support-message')
  for (const url of ['http://automation.alibabasigns.com.au/hook', 'https://localhost/hook', 'https://automation.alibabasigns.com.au.evil.example/hook', 'https://user:pass@automation.alibabasigns.com.au/hook', 'https://automation.alibabasigns.com.au/hook?secret=x']) assert.throws(() => supportWebhookUrl(url, {}))
  const secret = 's'.repeat(32)
  assert.equal(validSupportSecret(secret, secret), true)
  assert.equal(validSupportSecret('wrong', secret), false)
  assert.equal(validSupportSecret(null, secret), false)
  assert.equal(validSupportSecret('short', 'short'), false)
})

test('support request bodies enforce the byte limit even without a content-length header', async () => {
  const request = new Request('https://example.com/api/support/messages', { method: 'POST', body: 'x'.repeat(100) })
  await assert.rejects(boundedSupportBody(request, 50).text(), /too large/)
  assert.throws(() => boundedSupportBody(new Request('https://example.com', { method: 'POST', headers: { 'content-length': '100' }, body: 'test' }), 50), /too large/)
  assert.equal(await boundedSupportBody(new Request('https://example.com', { method: 'POST', body: 'safe' }), 50).text(), 'safe')
})
