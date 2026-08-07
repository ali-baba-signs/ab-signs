function publicBaseURL() {
  return process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.replace(/\/+$/, '')
}

export function getStoredAssetUrl(key: string) {
  const baseURL = publicBaseURL()
  if (!baseURL) throw new Error('NEXT_PUBLIC_R2_PUBLIC_BASE_URL is not configured')
  const safeKey = key.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment)).join('/')
  return `${baseURL}/${safeKey}`
}

export function getPublicAssetUrl(key: string, fallback?: string) {
  const baseURL = publicBaseURL()
  const enabled = process.env.NEXT_PUBLIC_R2_ASSETS_ENABLED === 'true'
  if (!baseURL || !enabled) {
    if (fallback) return fallback
    throw new Error('NEXT_PUBLIC_R2_PUBLIC_BASE_URL is not configured')
  }

  return getStoredAssetUrl(key)
}
