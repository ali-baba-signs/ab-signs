

function normalizeOrigin(value: string | undefined) {
  if (!value) return undefined

  const candidate = value.trim()
  if (!candidate || candidate.includes('your-domain.com')) return undefined
  if (/^[a-z][a-z\d+.-]*:/i.test(candidate) && !/^https?:\/\//i.test(candidate)) return undefined

  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.origin
  } catch {
    return undefined
  }
}

function configuredOrigins() {
  return [

    normalizeOrigin(process.env.BETTER_AUTH_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
    normalizeOrigin(process.env.V0_RUNTIME_URL),
    normalizeOrigin(process.env.VERCEL_URL),
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ].filter((origin): origin is string => Boolean(origin))
}

function requestOrigin(request: Request | undefined) {
  if (!request) return undefined

  try {
    return new URL(request.url).origin
  } catch {
    return undefined
  }
}

/**
 * Authentication URL priority is intentionally environment-only first. When
 * neither variable is set, returning undefined lets Better Auth derive the
 * exact origin from the incoming request instead of pinning the app to a host.
 */
export function getAuthBaseURL(request?: Request) {
  return normalizeOrigin(process.env.BETTER_AUTH_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    requestOrigin(request)
}

/**
 * Better Auth calls this for every state-changing request. Local development,
 * configured deployment URLs, and the request's own origin are trusted; no
 * application deployment domain is embedded in source code.
 */
export function getTrustedOrigins(request?: Request) {
  const origins = new Set(configuredOrigins())
  const origin = requestOrigin(request)
  if (origin) origins.add(origin)
  return [...origins]
}

