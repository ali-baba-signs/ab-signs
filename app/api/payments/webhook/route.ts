import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { and, eq, lt, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { couponRedemptions, couponReservations, coupons, orderEmailEvents, orders, paymentRecords, stripeWebhookEvents } from '@/lib/db/schema'
import { deliverOrderEmailEvent } from '@/lib/orders/emails'
import { stripeEventPaymentStatus } from '@/lib/payments/integrity'

const handledEvents = new Set(['payment_intent.succeeded', 'payment_intent.processing', 'payment_intent.payment_failed', 'payment_intent.canceled'])

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Webhook configuration is unavailable.' }, { status: 400 })
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const event = stripe.webhooks.constructEvent(await request.text(), signature, secret)
    if (!handledEvents.has(event.type)) return NextResponse.json({ received: true })
    const intent = event.data.object as Stripe.PaymentIntent
    const orderId = intent.metadata.orderId
    if (!orderId) return NextResponse.json({ received: true })
    let cardMetadata: Record<string, string> = {}
    if (event.type === 'payment_intent.succeeded' && intent.latest_charge) {
      const charge = typeof intent.latest_charge === 'string' ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge
      const card = charge.payment_method_details?.card
      if (card?.brand && card.last4) cardMetadata = { cardBrand: card.brand, cardLast4: card.last4, paymentMethodType: charge.payment_method_details?.type || 'card' }
    }
    const outcome = await db.transaction(async (tx) => {
      const insertedEvent = await tx.insert(stripeWebhookEvents).values({ eventId: event.id, eventType: event.type, objectId: intent.id }).onConflictDoNothing().returning({ eventId: stripeWebhookEvents.eventId })
      if (!insertedEvent.length) {
        if (event.type !== 'payment_intent.succeeded') return { duplicate: true, emailEventId: null }
        const staleBefore = new Date(Date.now() - 5 * 60 * 1000)
        const retried = await tx.update(orderEmailEvents).set({ status: 'processing', attempts: sql`${orderEmailEvents.attempts} + 1`, error: null, updatedAt: new Date() }).where(and(eq(orderEmailEvents.orderId, orderId), eq(orderEmailEvents.eventType, 'order_confirmation'), or(eq(orderEmailEvents.status, 'failed'), and(eq(orderEmailEvents.status, 'processing'), lt(orderEmailEvents.updatedAt, staleBefore))))).returning({ id: orderEmailEvents.id })
        return { duplicate: true, emailEventId: retried[0]?.id || null }
      }
      const [payment] = await tx.select().from(paymentRecords).where(and(eq(paymentRecords.orderId, orderId), eq(paymentRecords.externalId, intent.id))).limit(1)
      if (!payment) throw new Error('Stripe payment record was not found; the event must be retried.')
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
      if (!order) throw new Error('Stripe order was not found; the event must be retried.')
      if (Math.round(Number(payment.amount) * 100) !== intent.amount || payment.currency.toLowerCase() !== intent.currency.toLowerCase() || Number(order.totalAmount) !== Number(payment.amount)) throw new Error('Stripe payment amount does not match the stored order.')
      const successful = event.type === 'payment_intent.succeeded'
      // Stripe does not guarantee webhook delivery order. Once a verified
      // success is committed, an older processing/failure event cannot regress it.
      if (order.paymentStatus === 'paid' && !successful) return { duplicate: false, emailEventId: null }
      const status = stripeEventPaymentStatus(event.type)
      await tx.update(paymentRecords).set({ status, metadata: { ...((payment.metadata || {}) as Record<string, unknown>), paymentIntentId: intent.id, lastEventId: event.id, ...cardMetadata }, updatedAt: new Date() }).where(eq(paymentRecords.id, payment.id))
      await tx.update(orders).set({ paymentStatus: status, paymentMethod: 'stripe', ...(successful ? { status: 'payment_confirmed' as const } : {}), updatedAt: new Date() }).where(eq(orders.id, orderId))
      if (successful && order.couponId) {
        const inserted = await tx.insert(couponRedemptions).values({ couponId: order.couponId, userId: order.userId, orderId: order.id, paymentRecordId: payment.id, discountAmount: order.discountAmount, status: 'redeemed' }).onConflictDoNothing().returning({ id: couponRedemptions.id })
        if (inserted.length) {
          await tx.update(couponReservations).set({ status: 'redeemed', releasedAt: new Date(), releaseReason: 'payment_succeeded' }).where(and(eq(couponReservations.orderId, order.id), eq(couponReservations.status, 'reserved')))
          await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1`, reservedCount: sql`GREATEST(${coupons.reservedCount} - 1, 0)` }).where(eq(coupons.id, order.couponId))
        }
      } else if (event.type === 'payment_intent.canceled' && payment.status !== 'cancelled' && order.couponId) {
        const released = await tx.update(couponReservations).set({ status: 'released', releasedAt: new Date(), releaseReason: 'payment_canceled' }).where(and(eq(couponReservations.orderId, orderId), eq(couponReservations.status, 'reserved'))).returning({ id: couponReservations.id })
        if (released.length) await tx.update(coupons).set({ reservedCount: sql`GREATEST(${coupons.reservedCount} - 1, 0)` }).where(eq(coupons.id, order.couponId))
      }
      let emailEventId: string | null = null
      if (successful) {
        const claimed = await tx.insert(orderEmailEvents).values({ orderId, eventType: 'order_confirmation', status: 'processing' }).onConflictDoNothing().returning({ id: orderEmailEvents.id })
        emailEventId = claimed[0]?.id || null
      }
      return { duplicate: false, emailEventId }
    })
    if (outcome.emailEventId) await deliverOrderEmailEvent(outcome.emailEventId)
    return NextResponse.json({ received: true, duplicate: outcome.duplicate })
  } catch (error) {
    console.error('Stripe webhook processing failed', error instanceof Error ? error.message : 'Unknown webhook error')
    return NextResponse.json({ error: 'Webhook could not be verified or processed.' }, { status: 400 })
  }
}
