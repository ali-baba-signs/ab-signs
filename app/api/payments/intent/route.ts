import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { couponReservations, orders, paymentRecords } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { stripeMode } from '@/lib/payments/providers'
import { expireCouponReservations } from '@/lib/coupons/reservations'
import { assertAuthoritativeTotal, loadPaymentOrder, paymentSummary } from '@/lib/payments/order-summary'

export async function POST(request: NextRequest) {
  try {
    const { orderId, checkoutToken } = await request.json() as { orderId?: string; checkoutToken?: string }
    if (!orderId || !checkoutToken) throw new Error('Order authorization is required.')
    await expireCouponReservations({ orderId })
    const data = await loadPaymentOrder(orderId)
    if (!data) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } }, { status: 404 })
    const { order } = data
    const session = await getSession()
    if (order.userId ? order.userId !== session?.user.id : order.idempotencyKey !== checkoutToken) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'This order is not available for payment.' } }, { status: 403 })
    if (order.paymentStatus === 'paid') return NextResponse.json({ error: { code: 'ALREADY_PAID', message: 'This order has already been paid.' } }, { status: 409 })
    if (order.paymentStatus === 'cancelled') return NextResponse.json({ error: { code: 'PAYMENT_EXPIRED', message: 'This payment session has expired. Return to checkout to create a new order.' } }, { status: 410 })
    if (!order.policiesAccepted || !order.policiesAcceptedAt) return NextResponse.json({ error: { code: 'POLICIES_REQUIRED', message: 'Store policies must be accepted before payment.' } }, { status: 409 })
    if (order.couponId) {
      const [reservation] = await db.select({ status: couponReservations.status, expiresAt: couponReservations.expiresAt }).from(couponReservations).where(eq(couponReservations.orderId, order.id)).limit(1)
      if (!reservation || reservation.status !== 'reserved' || reservation.expiresAt <= new Date()) return NextResponse.json({ error: { code: 'PAYMENT_EXPIRED', message: 'This coupon payment session has expired. Return to checkout to reserve the offer again.' } }, { status: 410 })
    }
    const mode = stripeMode()
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const amount = assertAuthoritativeTotal(data)
    const existing = await db.select().from(paymentRecords).where(and(eq(paymentRecords.orderId, order.id), eq(paymentRecords.provider, 'stripe'))).limit(1)
    let intent: Stripe.PaymentIntent
    const previousAttempt = Number(((existing[0]?.metadata || {}) as Record<string, unknown>).attempt || 0)
    if (existing[0]?.externalId) intent = await stripe.paymentIntents.retrieve(existing[0].externalId)
    else intent = await stripe.paymentIntents.create({ amount, currency: order.currency.toLowerCase(), automatic_payment_methods: { enabled: true }, receipt_email: order.customerEmail, metadata: { orderId: order.id, orderNumber: order.orderNumber, userId: order.userId || 'guest' } }, { idempotencyKey: `order:${order.id}:attempt:1` })
    let attempt = Math.max(1, previousAttempt || 1)
    if (intent.status === 'canceled') {
      attempt += 1
      intent = await stripe.paymentIntents.create({ amount, currency: order.currency.toLowerCase(), automatic_payment_methods: { enabled: true }, receipt_email: order.customerEmail, metadata: { orderId: order.id, orderNumber: order.orderNumber, userId: order.userId || 'guest' } }, { idempotencyKey: `order:${order.id}:attempt:${attempt}` })
    }
    if (intent.amount !== amount || intent.currency.toLowerCase() !== order.currency.toLowerCase()) throw new Error('The stored Stripe payment does not match the authoritative order total.')
    await db.transaction(async (tx) => {
      if (existing[0]) await tx.update(paymentRecords).set({ externalId: intent.id, status: intent.status, mode, amount: order.totalAmount, currency: order.currency, updatedAt: new Date(), metadata: { paymentIntentId: intent.id, attempt } }).where(eq(paymentRecords.id, existing[0].id))
      else await tx.insert(paymentRecords).values({ orderId: order.id, provider: 'stripe', mode, status: intent.status, amount: order.totalAmount, currency: order.currency, externalId: intent.id, metadata: { paymentIntentId: intent.id, attempt } }).onConflictDoNothing()
      if (order.paymentStatus !== 'paid') await tx.update(orders).set({ paymentMethod: 'stripe', paymentStatus: 'processing', updatedAt: new Date() }).where(eq(orders.id, order.id))
    })
    return NextResponse.json({ data: { clientSecret: intent.status === 'succeeded' ? null : intent.client_secret, alreadySucceeded: intent.status === 'succeeded', summary: paymentSummary(data) } })
  } catch (error) {
    console.error('Stripe PaymentIntent creation failed', error)
    const message = error instanceof Error && /authoritative|policies|expired|match the authoritative/i.test(error.message) ? error.message : 'Unable to initialize secure payment. Please retry or return to checkout.'
    return NextResponse.json({ error: { code: 'PAYMENT_INTENT_FAILED', message } }, { status: 400 })
  }
}
