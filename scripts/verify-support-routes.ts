import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { handleSupportRequest } from '../lib/support/http'

async function main() {
  const url = 'https://alibabasigns.com.au/api/support/messages'
  const request = (body: unknown, headers: Record<string, string> = {}) => new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const oldSecret = process.env.SUPPORT_CHANNEL_SECRET
  try {
    delete process.env.SUPPORT_CHANNEL_SECRET
    assert.equal((await handleSupportRequest(request({}), true)).status, 401)
    process.env.SUPPORT_CHANNEL_SECRET = 'channel-test-only-'.repeat(3)
    assert.equal((await handleSupportRequest(request({}, { 'x-support-channel-secret': 'wrong' }), true)).status, 401)
    assert.equal((await handleSupportRequest(request({}, { origin: 'https://untrusted.example' }))).status, 403)
    assert.equal((await handleSupportRequest(request({}, { 'content-length': '999999' }))).status, 413)
    assert.equal((await handleSupportRequest(request({}))).status, 400)
    assert.equal((await handleSupportRequest(request({ website: 'spam.example' }))).status, 201)
    assert.equal((await handleSupportRequest(request({ source: 'Unknown' }, { 'x-support-channel-secret': process.env.SUPPORT_CHANNEL_SECRET }), true)).status, 400)
    assert.equal((await handleSupportRequest(new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid' }))).status, 400)
    console.log('PASS: support HTTP origin, channel secret, size, input, honeypot and malformed JSON guards. No database writes or outbound messages.')
  } finally {
    if(oldSecret === undefined)delete process.env.SUPPORT_CHANNEL_SECRET
    else process.env.SUPPORT_CHANNEL_SECRET = oldSecret
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
