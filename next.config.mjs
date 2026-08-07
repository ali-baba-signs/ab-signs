const publicAssetUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL
let r2RemotePattern
try {
  if (publicAssetUrl) {
    const url = new URL(publicAssetUrl)
    r2RemotePattern = {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      port: url.port,
      pathname: `${url.pathname.replace(/\/$/, '')}/**`,
    }
  }
} catch {
  r2RemotePattern = undefined
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: r2RemotePattern ? [r2RemotePattern] : [],
  },
}

export default nextConfig
