import test from 'node:test'
import assert from 'node:assert/strict'
// import { isLocalAuthBypass } from '../lib/auth/dev-bypass'

// test('MFA bypass requires explicit opt-in and local development configuration', () => {
//   const local = { NODE_ENV: 'development', BETTER_AUTH_URL: 'http://localhost:3000' }
//   assert.equal(isLocalAuthBypass(local), false)
//   assert.equal(isLocalAuthBypass({ ...local, AUTH_DEV_BYPASS: 'false' }), false)
//   assert.equal(isLocalAuthBypass({ ...local, AUTH_DEV_BYPASS: 'true' }), true)
//   assert.equal(isLocalAuthBypass({ ...local, AUTH_DEV_BYPASS: 'true', BETTER_AUTH_URL: 'http://127.0.0.1:3000' }), true)
// })

// test('MFA bypass cannot enable in preview, production, or a non-loopback origin', () => {
//   const local = { NODE_ENV: 'development', AUTH_DEV_BYPASS: 'true', BETTER_AUTH_URL: 'http://localhost:3000' }
//   for (const override of [
//     { NODE_ENV: 'production' }, { NODE_ENV: 'test' }, { VERCEL_ENV: 'preview' }, { VERCEL: '1' },
//     { CF_PAGES: '1' }, { VERCEL_URL: 'preview.example.test' },
//     { BETTER_AUTH_URL: 'https://www.alibabasigns.com.au' },
//     { NEXT_PUBLIC_SITE_URL: 'https://www.alibabasigns.com.au' },
//     { BETTER_AUTH_URL: 'http://localhost.evil.test' }, { BETTER_AUTH_URL: '' },
//   ]) assert.equal(isLocalAuthBypass({ ...local, ...override }), false, JSON.stringify(override))
// })
