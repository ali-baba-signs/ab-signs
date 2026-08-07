import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db/client'
import { getAuthBaseURL, getTrustedOrigins } from '@/lib/auth/origins'

export const adminAuth = betterAuth({
  database: pool,
  secret: process.env.ADMIN_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET,
  basePath: '/api/admin-auth',
  baseURL: getAuthBaseURL(),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    disableSignUp: process.env.NODE_ENV === 'production',
  },
  user: {
    modelName: 'admin_users',
    additionalFields: {
      role: { type: 'string', required: true, defaultValue: 'admin', input: false },
    },
  },
  session: {
    modelName: 'admin_sessions',
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 30,
  },
  account: { modelName: 'admin_accounts' },
  verification: { modelName: 'admin_verifications' },
  advanced: {
    cookiePrefix: 'alibaba_admin',
    ...(process.env.NODE_ENV === 'development'
      ? { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } }
      : {}),
  },
  trustedOrigins: getTrustedOrigins,
})
