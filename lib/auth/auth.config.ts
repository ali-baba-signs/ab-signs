import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db/client'
import { getAuthBaseURL, getTrustedOrigins } from '@/lib/auth/origins'
import { sendPasswordResetEmail } from '@/lib/contact/mailer'

export const auth = betterAuth({
  database: pool,
  baseURL: getAuthBaseURL(),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => sendPasswordResetEmail({ email: user.email, name: user.name, url }),
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: { '/request-password-reset': { window: 15 * 60, max: 5 } },
  },
  user: {
    modelName: 'users',
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'customer',
        input: false,
      },
    },
  },
  session: {
    modelName: 'sessions',
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: getTrustedOrigins,
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          // In dev (v0 preview iframe), force cross-site cookies so the
          // session cookie is stored by the browser.
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
