import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orders, paymentRecords } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { stripeMode } from '@/lib/payments/providers'

export async function POST(request: NextRequest) {
  try {
    const { orderId, checkoutToken } = await request.json() as { orderId?: string; checkoutToken?: string }
    if (!orderId || !checkoutToken) throw new Error('Order authorization is required.')
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } }, { status: 404 })
    const session = await getSession()
    if (order.userId ? order.userId !== session?.user.id : order.idempotencyKey !== checkoutToken) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'This order is not available for payment.' } }, { status: 403 })
    if (order.paymentStatus === 'paid') return NextResponse.json({ error: { code: 'ALREADY_PAID', message: 'This order has already been paid.' } }, { status: 409 })
    const mode = stripeMode()
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const amount = Math.round(Number(order.totalAmount) * 100)
    if (!Number.isSafeInteger(amount) || amount < 50) throw new Error('The authoritative order total is invalid for payment.')
    const existing = await db.select().from(paymentRecords).where(and(eq(paymentRecords.orderId, order.id), eq(paymentRecords.provider, 'stripe'))).limit(1)
    let intent: Stripe.PaymentIntent
    if (existing[0]?.externalId) intent = await stripe.paymentIntents.retrieve(existing[0].externalId)
    else intent = await stripe.paymentIntents.create({ amount, currency: order.currency.toLowerCase(), automatic_payment_methods: { enabled: true }, receipt_email: order.customerEmail, metadata: { orderId: order.id, orderNumber: order.orderNumber } }, { idempotencyKey: `order:${order.id}` })
    await db.transaction(async (tx) => {
      if (existing[0]) await tx.update(paymentRecords).set({ externalId: intent.id, status: intent.status, mode, updatedAt: new Date(), metadata: { paymentIntentId: intent.id } }).where(eq(paymentRecords.id, existing[0].id))
      else await tx.insert(paymentRecords).values({ orderId: order.id, provider: 'stripe', mode, status: intent.status, amount: order.totalAmount, currency: order.currency, externalId: intent.id, metadata: { paymentIntentId: intent.id } })
      await tx.update(orders).set({ paymentMethod: 'stripe', paymentStatus: 'processing', updatedAt: new Date() }).where(eq(orders.id, order.id))
    })
    return NextResponse.json({ data: { clientSecret: intent.client_secret } })
  } catch (error) {
    console.error('Stripe PaymentIntent creation failed', error)
    return NextResponse.json({ error: { code: 'PAYMENT_INTENT_FAILED', message: error instanceof Error ? error.message : 'Unable to initialize secure payment.' } }, { status: 400 })
  }
}
