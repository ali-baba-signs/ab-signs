import 'server-only'

/** Stripe is deliberately the only checkout provider. */
export const PAYMENT_PROVIDER = 'stripe' as const

export function stripeMode() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || !key.startsWith('sk_')) throw new Error('Secure payments are not configured.')
  return key.startsWith('sk_live_') ? 'live' : 'test'
}
