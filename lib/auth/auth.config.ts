import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'
import { pool } from '@/lib/db/client'
import { getAuthBaseURL, getTrustedOrigins } from '@/lib/auth/origins'
import { sendAccountVerificationEmail, sendLoginVerificationCode, sendPasswordResetEmail } from '@/lib/contact/mailer'
import { captureAuthEmailDeliveryFailure, type AuthEmailKind } from '@/lib/auth/email-delivery'

const authBaseURL = getAuthBaseURL()

async function deliverAuthenticationEmail(kind: AuthEmailKind, delivery: () => Promise<void>) {
  try {
    await delivery()
    if (process.env.NODE_ENV === 'development') console.info(`Authentication ${kind} email accepted by SMTP.`)
  } catch (error) {
    captureAuthEmailDeliveryFailure(kind, error)
    const details = error as { code?: unknown; responseCode?: unknown; command?: unknown; message?: unknown }
    console.error('Authentication email delivery failed', {
      kind,
      code: details?.code,
      responseCode: details?.responseCode,
      command: details?.command,
      message: details?.message,
    })
    throw error
  }
}

export const auth = betterAuth({
  database: pool,
  ...(authBaseURL ? { baseURL: authBaseURL } : {}),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => deliverAuthenticationEmail('password-reset', () => sendPasswordResetEmail({ email: user.email, name: user.name, url })),
  },
  emailVerification: {
    expiresIn: 60 * 60,
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => deliverAuthenticationEmail('verification', () => sendAccountVerificationEmail({ email: user.email, name: user.name, url })),
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
  plugins: [twoFactor({
    twoFactorTable: 'two_factors',
    twoFactorCookieMaxAge: 10 * 60,
    accountLockout: { enabled: true, maxFailedAttempts: 10, durationSeconds: 15 * 60 },
    totpOptions: { disable: true },
    otpOptions: {
      period: 5,
      digits: 6,
      allowedAttempts: 5,
      storeOTP: 'hashed',
      sendOTP: async ({ user, otp }) => deliverAuthenticationEmail('login-code', () => sendLoginVerificationCode({ email: user.email, name: user.name, code: otp })),
    },
  })],
})
