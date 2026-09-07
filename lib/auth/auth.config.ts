import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'
import { pool } from '@/lib/db/client'
import { getAuthBaseURL, getTrustedOrigins } from '@/lib/auth/origins'
import { sendAccountVerificationEmail, sendLoginVerificationCode, sendPasswordResetEmail } from '@/lib/contact/mailer'

const authBaseURL = getAuthBaseURL()
const crossSiteDevelopment = process.env.NODE_ENV === 'development' && authBaseURL.startsWith('https://')

export const auth = betterAuth({
  database: pool,
  baseURL: authBaseURL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => sendPasswordResetEmail({ email: user.email, name: user.name, url }),
  },
  emailVerification: {
    expiresIn: 60 * 60,
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => sendAccountVerificationEmail({ email: user.email, name: user.name, url }),
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/request-password-reset': { window: 15 * 60, max: 5 },
      '/send-verification-email': { window: 15 * 60, max: 5 },
      '/two-factor/send-otp': { window: 60, max: 3 },
      '/two-factor/verify-otp': { window: 10 * 60, max: 10 },
    },
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
  ...(crossSiteDevelopment
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
  plugins: [
    twoFactor({
      twoFactorTable: 'two_factors',
      twoFactorCookieMaxAge: 10 * 60,
      accountLockout: { enabled: true, maxFailedAttempts: 10, durationSeconds: 15 * 60 },
      totpOptions: { disable: true },
      otpOptions: {
        period: 5,
        digits: 6,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        sendOTP: async ({ user, otp }) => sendLoginVerificationCode({ email: user.email, name: user.name, code: otp }),
      },
    }),
  ],
})
