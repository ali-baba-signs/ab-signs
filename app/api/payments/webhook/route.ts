import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { reconcileStripePayment, type StripePaymentEvent } from '@/lib/payments/reconcile'

const handledEvents = new Set<StripePaymentEvent>(['payment_intent.succeeded', 'payment_intent.processing', 'payment_intent.payment_failed', 'payment_intent.canceled'])

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Webhook configuration is unavailable.' }, { status: 400 })
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10_000, maxNetworkRetries: 1 })
    const event = stripe.webhooks.constructEvent(await request.text(), signature, secret)
    if (!handledEvents.has(event.type as StripePaymentEvent)) return NextResponse.json({ received: true })
    const intent = event.data.object as Stripe.PaymentIntent
    let cardMetadata: Record<string, string> = {}
    if (event.type === 'payment_intent.succeeded' && intent.latest_charge) {
      const charge = typeof intent.latest_charge === 'string' ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge
      const card = charge.payment_method_details?.card
      if (card?.brand && card.last4) cardMetadata = { cardBrand: card.brand, cardLast4: card.last4, paymentMethodType: charge.payment_method_details?.type || 'card' }
    }
    const result = await reconcileStripePayment({ intent, eventType: event.type as StripePaymentEvent, eventId: event.id, cardMetadata })
    return NextResponse.json({ received: true, duplicate: result.duplicate })
  } catch (error) {
    console.error('Stripe webhook processing failed', error instanceof Error ? error.message : 'Unknown webhook error')
    return NextResponse.json({ error: 'Webhook could not be verified or processed.' }, { status: 400 })
  }
}
