/** A local MFA escape hatch. Never changes the user's stored MFA setting. */
// export function isLocalAuthBypass(env: Record<string, string | undefined> = process.env) {
//   if (env.AUTH_DEV_BYPASS !== 'true' || env.NODE_ENV !== 'development') return false
//   if (env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL || env.CF_PAGES || env.CF_PAGES_URL || env.V0_RUNTIME_URL) return false
//   const urls = [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_SITE_URL].filter((value): value is string => Boolean(value))
//   if (!urls.length) return false
//   return urls.every((value) => {
//     try {
//       const url = new URL(value)
//       return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
//     } catch { return false }
//   })
// }
