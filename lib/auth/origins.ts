const LOCAL_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']
const PRODUCTION_ORIGINS = ['https://alibabasigns.com.au', 'https://www.alibabasigns.com.au','https://devtest.alibabasigns.com.au']


function normalizeOrigin(value: string | undefined) {
  if (!value || value.includes('your-domain.com')) return undefined

  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).origin
  } catch {
    return undefined
  }
}

function configuredOrigins() {
  return [
    ...LOCAL_ORIGINS,
    ...PRODUCTION_ORIGINS,
    normalizeOrigin(process.env.BETTER_AUTH_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
    normalizeOrigin(process.env.V0_RUNTIME_URL),
    normalizeOrigin(process.env.VERCEL_URL),
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ].filter((origin): origin is string => Boolean(origin))
}

/**
 * Prefer the exact Vercel deployment URL for preview builds. A localhost
 * BETTER_AUTH_URL is useful locally but must never override a deployed host.
 */
export function getAuthBaseURL() {
  const vercelURL = normalizeOrigin(process.env.VERCEL_URL)
  const configuredURL = normalizeOrigin(process.env.BETTER_AUTH_URL)

  if (vercelURL) return vercelURL
  if (process.env.NODE_ENV !== 'production' && configuredURL) return configuredURL
  if (configuredURL && !configuredURL.includes('localhost') && !configuredURL.includes('127.0.0.1')) {
    return configuredURL
  }

  return normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeOrigin(process.env.V0_RUNTIME_URL) ??
    'http://localhost:3000'
}

/**
 * Better Auth calls this for every state-changing request. Alongside explicitly
 * configured origins, allow only the request's exact effective host. This
 * supports branch preview URLs without trusting every site on vercel.app.
 */
export function getTrustedOrigins(request?: Request) {
  const origins = new Set(configuredOrigins())
  if (!request) return [...origins]

  const requestURL = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const effectiveHost = forwardedHost || requestURL.host
  const effectiveProtocol = forwardedProto === 'http' || forwardedProto === 'https'
    ? forwardedProto
    : requestURL.protocol.replace(':', '')

  if (effectiveHost) origins.add(`${effectiveProtocol}://${effectiveHost}`)
  origins.add(requestURL.origin)

  return [...origins]
}
