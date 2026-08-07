import 'server-only'

export type PaymentProvider = 'stripe' | 'card' | 'paypal'
export type TestOutcome = 'success' | 'failure' | 'cancel'

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return value === 'stripe' || value === 'card' || value === 'paypal'
}

export function isTestOutcome(value: unknown): value is TestOutcome {
  return value === 'success' || value === 'failure' || value === 'cancel'
}

export function validateProviderConfiguration(provider: PaymentProvider, testMode: boolean) {
  if (testMode) return
  if (provider === 'paypal' && (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET)) {
    throw new Error('PayPal live mode is not configured.')
  }
  if ((provider === 'stripe' || provider === 'card') && (!process.env.STRIPE_SECRET_KEY || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)) {
    throw new Error('Stripe live mode is not configured.')
  }
  throw new Error('Live payment processing requires the provider SDK integration. Enable test mode to use the safe simulator.')
}

export function simulatePayment(provider: PaymentProvider, outcome: TestOutcome) {
  const paymentStatus = outcome === 'success' ? 'paid' : outcome === 'failure' ? 'payment_failed' : 'cancelled'
  return {
    paymentStatus,
    orderStatus: outcome === 'success' ? 'confirmed' as const : outcome === 'cancel' ? 'cancelled' as const : 'pending' as const,
    externalId: `test_${provider}_${crypto.randomUUID()}`,
    metadata: { simulated: true, outcome },
  }
}
