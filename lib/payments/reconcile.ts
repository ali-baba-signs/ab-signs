import 'server-only'

import type Stripe from 'stripe'
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { couponRedemptions, couponReservations, coupons, orderEmailEvents, orders, paymentRecords, stripeWebhookEvents } from '@/lib/db/schema'
import { deliverOrderEmailEvent } from '@/lib/orders/emails'
import { stripeEventPaymentStatus } from '@/lib/payments/integrity'

export type StripePaymentEvent = 'payment_intent.succeeded' | 'payment_intent.processing' | 'payment_intent.payment_failed' | 'payment_intent.canceled'

export function paymentEventForIntent(intent: Stripe.PaymentIntent): StripePaymentEvent {
  if (intent.status === 'succeeded') return 'payment_intent.succeeded'
  if (intent.status === 'canceled') return 'payment_intent.canceled'
  if (intent.status === 'processing') return 'payment_intent.processing'
  if (intent.last_payment_error) return 'payment_intent.payment_failed'
  return 'payment_intent.processing'
}

export async function reconcileStripePayment(input: { intent: Stripe.PaymentIntent; eventType: StripePaymentEvent; eventId: string; cardMetadata?: Record<string, string> }) {
  const { intent, eventType, eventId, cardMetadata = {} } = input
  const orderId = intent.metadata.orderId
  if (!orderId) return { duplicate: false, skipped: true }
  const outcome = await db.transaction(async (tx) => {
    const insertedEvent = await tx.insert(stripeWebhookEvents).values({ eventId, eventType, objectId: intent.id }).onConflictDoNothing().returning({ eventId: stripeWebhookEvents.eventId })
    if (!insertedEvent.length) {
      if (eventType !== 'payment_intent.succeeded') return { duplicate: true, emailEventIds: [] as string[] }
      const staleBefore = new Date(Date.now() - 5 * 60 * 1000)
      const retried = await tx.update(orderEmailEvents).set({ status: 'processing', attempts: sql`${orderEmailEvents.attempts} + 1`, error: null, updatedAt: new Date() }).where(and(eq(orderEmailEvents.orderId, orderId), inArray(orderEmailEvents.eventType, ['order_confirmation', 'sales_paid_order']), or(eq(orderEmailEvents.status, 'failed'), and(eq(orderEmailEvents.status, 'processing'), lt(orderEmailEvents.updatedAt, staleBefore))))).returning({ id: orderEmailEvents.id })
      return { duplicate: true, emailEventIds: retried.map((event) => event.id) }
    }
    const [payment] = await tx.select().from(paymentRecords).where(and(eq(paymentRecords.orderId, orderId), eq(paymentRecords.externalId, intent.id))).limit(1)
    if (!payment) throw new Error('Stripe payment record was not found; the event must be retried.')
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new Error('Stripe order was not found; the event must be retried.')
    if (Math.round(Number(payment.amount) * 100) !== intent.amount || payment.currency.toLowerCase() !== intent.currency.toLowerCase() || Number(order.totalAmount) !== Number(payment.amount)) throw new Error('Stripe payment amount does not match the stored order.')
    const successful = eventType === 'payment_intent.succeeded'
    if (order.paymentStatus === 'paid' && !successful) return { duplicate: false, emailEventIds: [] as string[] }
    const status = stripeEventPaymentStatus(eventType)
    await tx.update(paymentRecords).set({ status, metadata: { ...((payment.metadata || {}) as Record<string, unknown>), paymentIntentId: intent.id, lastEventId: eventId, ...cardMetadata }, updatedAt: new Date() }).where(eq(paymentRecords.id, payment.id))
    await tx.update(orders).set({ paymentStatus: status, paymentMethod: 'stripe', ...(successful && order.status !== 'artwork_pending' ? { status: 'payment_confirmed' as const } : {}), updatedAt: new Date() }).where(eq(orders.id, orderId))
    if (successful && order.couponId) {
      const inserted = await tx.insert(couponRedemptions).values({ couponId: order.couponId, userId: order.userId, orderId: order.id, paymentRecordId: payment.id, discountAmount: order.discountAmount, status: 'redeemed' }).onConflictDoNothing().returning({ id: couponRedemptions.id })
      if (inserted.length) {
        await tx.update(couponReservations).set({ status: 'redeemed', releasedAt: new Date(), releaseReason: 'payment_succeeded' }).where(and(eq(couponReservations.orderId, order.id), eq(couponReservations.status, 'reserved')))
        await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1`, reservedCount: sql`GREATEST(${coupons.reservedCount} - 1, 0)` }).where(eq(coupons.id, order.couponId))
      }
    } else if (eventType === 'payment_intent.canceled' && payment.status !== 'cancelled' && order.couponId) {
      const released = await tx.update(couponReservations).set({ status: 'released', releasedAt: new Date(), releaseReason: 'payment_canceled' }).where(and(eq(couponReservations.orderId, orderId), eq(couponReservations.status, 'reserved'))).returning({ id: couponReservations.id })
      if (released.length) await tx.update(coupons).set({ reservedCount: sql`GREATEST(${coupons.reservedCount} - 1, 0)` }).where(eq(coupons.id, order.couponId))
    }
    const emailEventIds: string[] = []
    if (successful) {
      const claimed = await tx.insert(orderEmailEvents).values([
        { orderId, eventType: 'order_confirmation', dedupeKey: 'lifecycle', status: 'processing' },
        { orderId, eventType: 'sales_paid_order', dedupeKey: 'lifecycle', status: 'processing' },
      ]).onConflictDoNothing().returning({ id: orderEmailEvents.id })
      emailEventIds.push(...claimed.map((event) => event.id))
    }
    return { duplicate: false, emailEventIds }
  })
  await Promise.all(outcome.emailEventIds.map((emailEventId) => deliverOrderEmailEvent(emailEventId)))
  return { duplicate: outcome.duplicate, skipped: false }
}
