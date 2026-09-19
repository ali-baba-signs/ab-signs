import test from 'node:test'
import assert from 'node:assert/strict'
import { getAuthBaseURL, getTrustedOrigins } from '../lib/auth/origins'

const ENV_KEYS = [
  'BETTER_AUTH_URL',
  'NEXT_PUBLIC_SITE_URL',
  'V0_RUNTIME_URL',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
] as const

function withEnvironment(values: Partial<Record<(typeof ENV_KEYS)[number], string>>, assertion: () => void) {
  const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

  try {
    for (const key of ENV_KEYS) delete process.env[key]
    Object.assign(process.env, values)
    assertion()
  } finally {
    for (const key of ENV_KEYS) {
      const value = original[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('auth base URL prioritizes BETTER_AUTH_URL over every deployment URL', () => {
  withEnvironment({
    BETTER_AUTH_URL: 'https://auth.example.test/path',
    NEXT_PUBLIC_SITE_URL: 'https://site.example.test',
    VERCEL_URL: 'preview.example.test',
  }, () => {
    assert.equal(getAuthBaseURL(), 'https://auth.example.test')
  })
})

test('auth base URL uses NEXT_PUBLIC_SITE_URL when BETTER_AUTH_URL is absent', () => {
  withEnvironment({ NEXT_PUBLIC_SITE_URL: 'https://site.example.test/' }, () => {
    assert.equal(getAuthBaseURL(), 'https://site.example.test')
  })
})

test('auth base URL falls back to the incoming request origin', () => {
  withEnvironment({}, () => {
    const request = new Request('http://localhost:4312/api/auth/session')
    assert.equal(getAuthBaseURL(request), 'http://localhost:4312')
    assert.equal(getAuthBaseURL(), undefined)
  })
})

test('trusted origins contain local, configured, and current request origins only', () => {
  withEnvironment({ NEXT_PUBLIC_SITE_URL: 'https://deployment.example.test' }, () => {
    const origins = getTrustedOrigins(new Request('https://request.example.test/api/auth/sign-in'))
    assert.deepEqual(origins, [
      'https://deployment.example.test',
      'https://request.example.test',
  
    ])
    assert.ok(!origins.some((origin) => origin.includes('alibabasigns.com.au')))
  })
})

test('invalid or non-http environment URLs are ignored', () => {
  withEnvironment({ BETTER_AUTH_URL: 'ftp://unsafe.example.test', NEXT_PUBLIC_SITE_URL: 'https://safe.example.test' }, () => {
    assert.equal(getAuthBaseURL(), 'https://safe.example.test')
  })
})

