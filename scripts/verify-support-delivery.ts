import assert from 'node:assert/strict'
import { forwardSupportEvent, supportPayload, verifiedSupportOrder, type SupportEvent } from '../lib/support/handler'
import { DEFAULT_SUPPORT_SETTINGS } from '../lib/support/settings'
import { validateSupportMessage } from '../lib/support/validation'

async function main() {
  const oldSecret = process.env.SUPPORT_WEBHOOK_SECRET
  const oldUrl = process.env.SUPPORT_WEBHOOK_URL
  const oldHosts = process.env.SUPPORT_WEBHOOK_ALLOWED_HOSTS
  try {
    process.env.SUPPORT_WEBHOOK_SECRET = 'verification-only-secret-'.repeat(2)
    process.env.SUPPORT_WEBHOOK_URL = 'https://automation.alibabasigns.com.au/webhook/support-message'
    process.env.SUPPORT_WEBHOOK_ALLOWED_HOSTS = 'automation.alibabasigns.com.au'
    const event: SupportEvent = { ...validateSupportMessage({ customerName: 'Test Customer', customerEmail: 'customer@example.com', category: 'Custom quote', message: 'Please quote for these banners.', product: 'Banner', size: '2 x 1 m', quantity: 2 }), eventId: 'test-event', timestamp: '2026-09-19T02:00:00Z', priority: 'HIGH', artwork: null, orderStatus: null }
    const settings = { ...DEFAULT_SUPPORT_SETTINGS, notificationEmails: ['new-team@example.com'] }
    let calls = 0
    const mock: typeof fetch = async (_url, init) => {
      calls++
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('x-support-webhook-secret'), process.env.SUPPORT_WEBHOOK_SECRET)
      assert.equal(headers.get('x-support-event-id'), event.eventId)
      assert.equal(init?.redirect, 'error')
      const payload = JSON.parse(String(init?.body))
      assert.equal(payload.priority, 'HIGH')
      assert.equal(payload.quote.quantity, 2)
      assert.equal(payload.acknowledgement, settings.afterHoursResponse)
      assert.deepEqual(payload.notification.emails, ['new-team@example.com'])
      assert.equal(String(init?.body).includes(process.env.SUPPORT_WEBHOOK_SECRET!), false)
      return new Response(null, { status: 202 })
    }
    await forwardSupportEvent(event, settings, mock)
    assert.equal(calls, 1)
    const faq = { ...event, category: 'Product information' as const, action: 'products', quote: null }
    await forwardSupportEvent(faq, settings, mock)
    assert.equal(calls, 1, 'FAQ must not call n8n')
    assert.equal(supportPayload({ ...event, action: 'complaint' }, settings).sendCustomerEmail, false)
    assert.equal(supportPayload({ ...event, action: 'complaint' }, settings).notifyTeam, true)
    assert.equal(supportPayload({ ...event, timestamp: '2026-09-21T02:00:00Z', priority: 'NORMAL', category: 'General enquiry', quote: null }, settings).acknowledgement, settings.businessHoursResponse)
    await assert.rejects(forwardSupportEvent(event, settings, async () => new Response(null, { status: 500 })), /HTTP 500/)
    await assert.rejects(forwardSupportEvent({ ...event, artworkExpected: true }, settings, mock), /artwork upload/)
    await assert.rejects(forwardSupportEvent(event, { ...settings, notificationEmails: [] }, mock), /not configured/)
    delete process.env.SUPPORT_WEBHOOK_SECRET
    await assert.rejects(forwardSupportEvent(event, settings, mock), /not configured/)
    const orderMessage = validateSupportMessage({ ...event, category: 'Order status', orderNumber: 'ORDER-PRIVATE' })
    assert.equal(await verifiedSupportOrder(orderMessage, null), null)
    assert.equal(await verifiedSupportOrder(orderMessage, { id: 'other', email: 'customer@example.com', emailVerified: false }), null)
    assert.equal(await verifiedSupportOrder(orderMessage, { id: 'other', email: 'other@example.com', emailVerified: true }), null)
    console.log('PASS: mocked webhook acceptance/failure, priority, business hours, edited recipients, secrets and unverified order protection. No external messages sent.')
  } finally {
    for (const [key, value] of Object.entries({ SUPPORT_WEBHOOK_SECRET: oldSecret, SUPPORT_WEBHOOK_URL: oldUrl, SUPPORT_WEBHOOK_ALLOWED_HOSTS: oldHosts })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
