import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { couponRedemptions, couponReservations, coupons, orders, paymentRecords } from '@/lib/db/schema'

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
      if (successful) {
        const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
        if (order?.couponId) {
          // The unique order redemption makes repeated webhook delivery a no-op.
          const inserted = await tx.insert(couponRedemptions).values({ couponId: order.couponId, userId: order.userId, orderId: order.id, paymentRecordId: payment.id, discountAmount: order.discountAmount, status: 'redeemed' }).onConflictDoNothing().returning({ id: couponRedemptions.id })
          if (inserted.length) {
            await tx.update(couponReservations).set({ status: 'redeemed', releasedAt: new Date(), releaseReason: 'payment_succeeded' }).where(and(eq(couponReservations.orderId, order.id), eq(couponReservations.status, 'reserved')))
            const changed = await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1`, reservedCount: sql`GREATEST(${coupons.reservedCount} - 1, 0)` }).where(eq(coupons.id, order.couponId)).returning({ id: coupons.id })
            if (!changed.length) throw new Error('Coupon usage limit was reached before payment confirmation.')
          }
        }
      } else if (event.type === 'payment_intent.canceled' && payment.status !== 'cancelled') {
        const [order] = await tx.select({ couponId: orders.couponId }).from(orders).where(eq(orders.id, orderId)).limit(1)
        if (order?.couponId) {
          const released = await tx.update(couponReservations).set({ status: 'released', releasedAt: new Date(), releaseReason: 'payment_canceled' }).where(and(eq(couponReservations.orderId, orderId), eq(couponReservations.status, 'reserved'))).returning({ id: couponReservations.id })
          if (released.length) await tx.update(coupons).set({ reservedCount: sql`GREATEST(${coupons.reservedCount} - 1, 0)` }).where(eq(coupons.id, order.couponId))
        }
      }
    })
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook verification failed', error)
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 })
  }
}
