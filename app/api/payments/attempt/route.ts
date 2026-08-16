import { NextResponse } from 'next/server'

// Compatibility response for stale clients. This endpoint can never alter an order.
export async function POST() {
  return NextResponse.json({ error: { code: 'PAYMENT_FLOW_REMOVED', message: 'Payment simulation has been removed. Complete payment securely with Stripe.' } }, { status: 410 })
}
