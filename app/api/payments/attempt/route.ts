import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orders, paymentRecords } from '@/lib/db/schema'
import { isPaymentProvider, isTestOutcome, simulatePayment, validateProviderConfiguration } from '@/lib/payments/providers'
import { loadStoreSettings } from '@/lib/store/load-settings'
import { getSession } from '@/lib/auth/middleware'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>
    const orderId = typeof body.orderId === 'string' ? body.orderId : ''
    const checkoutToken = typeof body.checkoutToken === 'string' ? body.checkoutToken : ''
    const provider = body.provider
    const outcome = body.outcome
    if (!orderId || !isPaymentProvider(provider) || !isTestOutcome(outcome)) throw new Error('Order, provider, and test outcome are required.')
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } }, { status: 404 })
    const session = await getSession()
    if (order.userId && order.userId !== session?.user.id) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'This order does not belong to you.' } }, { status: 403 })
    if (!order.userId && checkoutToken !== order.idempotencyKey) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'The guest checkout token is invalid.' } }, { status: 403 })
    if (order.paymentStatus === 'paid') return NextResponse.json({ data: { order, duplicate: true } })
    const settings = await loadStoreSettings()
    validateProviderConfiguration(provider, settings.paymentTestMode)
    const simulated = simulatePayment(provider, outcome)
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(orders).set({ paymentMethod: provider, paymentStatus: simulated.paymentStatus, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning()
      await tx.insert(paymentRecords).values({
        orderId, provider, mode: 'test', status: simulated.paymentStatus, amount: order.totalAmount, currency: order.currency,
        externalId: simulated.externalId, metadata: simulated.metadata,
      })
      return rows
    })
    return NextResponse.json({ data: { order: updated, payment: { status: simulated.paymentStatus, provider, mode: 'test' } } })
  } catch (error) {
    console.error('Payment attempt failed', error)
    return NextResponse.json({ error: { code: 'PAYMENT_FAILED', message: error instanceof Error ? error.message : 'The payment attempt failed.' } }, { status: 400 })
  }
}
