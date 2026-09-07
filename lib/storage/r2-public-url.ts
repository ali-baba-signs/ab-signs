export const R2_PUBLIC_BASE_URL = 'https://assets.alibabasigns.com.au'

function encodeObjectKey(key: string) {
  return key.split('/').filter(Boolean).map((segment) => {
    try { return encodeURIComponent(decodeURIComponent(segment)) } catch { return encodeURIComponent(segment) }
  }).join('/')
}

export function getStoredAssetUrl(key: string) {
  return `${R2_PUBLIC_BASE_URL}/${encodeObjectKey(key)}`
}

export function getPublicAssetUrl(key: string, _fallback?: string) {
  return getStoredAssetUrl(key)
}

/**
 * Produces a canonical response URL without changing the stored database value.
 * Object keys are authoritative. Legacy r2.dev URLs are mapped in memory only.
 */
export function canonicalStoredAssetUrl(url: string | null | undefined, objectKey?: string | null) {
  if (objectKey) return getStoredAssetUrl(objectKey)
  if (!url) return url ?? null
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'assets.alibabasigns.com.au' || parsed.hostname.endsWith('.r2.dev')) {
      return getStoredAssetUrl(parsed.pathname)
    }
  } catch {
    return url
  }
  return url
}
