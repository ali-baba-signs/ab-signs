import 'server-only'

import Stripe from 'stripe'
import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { couponReservations, coupons, orders, paymentRecords } from '@/lib/db/schema'

export const COUPON_RESERVATION_MINUTES = 30

export function couponReservationExpiry(from = new Date()) {
  return new Date(from.getTime() + COUPON_RESERVATION_MINUTES * 60_000)
}

export async function releaseCouponReservation(reservationId: string, reason: string) {
  return db.transaction(async (tx) => {
    const [released] = await tx.update(couponReservations).set({ status: 'released', releasedAt: new Date(), releaseReason: reason.slice(0, 80) }).where(and(eq(couponReservations.id, reservationId), eq(couponReservations.status, 'reserved'))).returning({ couponId: couponReservations.couponId, orderId: couponReservations.orderId })
    if (!released) return false
    await tx.update(coupons).set({ reservedCount: sql`GREATEST(${coupons.reservedCount} - 1, 0)` }).where(eq(coupons.id, released.couponId))
    await tx.update(orders).set({ status: 'cancelled', paymentStatus: 'cancelled', updatedAt: new Date() }).where(and(eq(orders.id, released.orderId), sql`${orders.paymentStatus} <> 'paid'`))
    return true
  })
}

/**
 * Safely expires abandoned holds. A Stripe intent is cancelled first so a
 * released coupon slot cannot subsequently be charged by an old checkout.
 */
export async function expireCouponReservations(options: { orderId?: string; limit?: number } = {}) {
  const now = new Date()
  const condition = options.orderId
    ? and(eq(couponReservations.status, 'reserved'), eq(couponReservations.orderId, options.orderId), lt(couponReservations.expiresAt, now))
    : and(eq(couponReservations.status, 'reserved'), lt(couponReservations.expiresAt, now))
  const expired = await db.select({ reservation: couponReservations, paymentExternalId: paymentRecords.externalId }).from(couponReservations).leftJoin(paymentRecords, eq(paymentRecords.orderId, couponReservations.orderId)).where(condition).limit(Math.min(Math.max(options.limit || 50, 1), 200))
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
  let released = 0; let retained = 0
  for (const row of expired) {
    if (row.paymentExternalId) {
      if (!stripe) { retained += 1; continue }
      try {
        let intent = await stripe.paymentIntents.retrieve(row.paymentExternalId)
        if (intent.status === 'succeeded') { retained += 1; continue }
        if (intent.status !== 'canceled') intent = await stripe.paymentIntents.cancel(intent.id)
        if (intent.status !== 'canceled') { retained += 1; continue }
      } catch (error) {
        console.error('Expired coupon reservation could not cancel Stripe intent', { reservationId: row.reservation.id, error })
        retained += 1; continue
      }
    }
    if (await releaseCouponReservation(row.reservation.id, 'checkout_timeout')) released += 1
  }
  return { checked: expired.length, released, retained }
}
