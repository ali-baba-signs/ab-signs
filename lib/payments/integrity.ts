export function moneyCents(value: unknown) { return Math.round(Number(value || 0) * 100) }

export function authoritativeTotalCents(input: { itemTotals: unknown[]; discount: unknown; shipping: unknown; tax: unknown; total: unknown }) {
  const itemSubtotal = input.itemTotals.reduce<number>((sum, value) => sum + moneyCents(value), 0)
  const expected = itemSubtotal - moneyCents(input.discount) + moneyCents(input.shipping) + moneyCents(input.tax)
  const total = moneyCents(input.total)
  if (!input.itemTotals.length || expected !== total || total < 50 || !Number.isSafeInteger(total)) throw new Error('The authoritative order total is inconsistent. Return to checkout and try again.')
  return total
}

export function stripeEventPaymentStatus(type: string) {
  if (type === 'payment_intent.succeeded') return 'paid' as const
  if (type === 'payment_intent.canceled') return 'cancelled' as const
  if (type === 'payment_intent.payment_failed') return 'payment_failed' as const
  return 'processing' as const
}
