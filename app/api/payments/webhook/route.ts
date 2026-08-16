import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orders, paymentRecords } from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Webhook configuration is unavailable.' }, { status: 400 })
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const event = stripe.webhooks.constructEvent(await request.text(), signature, secret)
    if (!['payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled'].includes(event.type)) return NextResponse.json({ received: true })
    const intent = event.data.object as Stripe.PaymentIntent
    const orderId = intent.metadata.orderId
    if (!orderId) return NextResponse.json({ received: true })
    await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(paymentRecords).where(and(eq(paymentRecords.orderId, orderId), eq(paymentRecords.externalId, intent.id))).limit(1)
      if (!payment) return
      const successful = event.type === 'payment_intent.succeeded'
      const status = successful ? 'paid' : event.type === 'payment_intent.canceled' ? 'cancelled' : 'payment_failed'
      await tx.update(paymentRecords).set({ status, metadata: { paymentIntentId: intent.id, eventId: event.id }, updatedAt: new Date() }).where(eq(paymentRecords.id, payment.id))
      await tx.update(orders).set({ paymentStatus: status, paymentMethod: 'stripe', ...(successful ? { status: 'payment_confirmed' as const } : {}), updatedAt: new Date() }).where(eq(orders.id, orderId))
    })
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook verification failed', error)
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 })
  }
}
