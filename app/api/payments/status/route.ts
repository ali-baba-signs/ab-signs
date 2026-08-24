import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/middleware'
import { loadPaymentOrder, paymentSummary } from '@/lib/payments/order-summary'

export async function POST(request: NextRequest) {
  try {
    const { orderId, checkoutToken } = await request.json() as { orderId?: string; checkoutToken?: string }
    if (!orderId || !checkoutToken) throw new Error('Order authorization is required.')
    const data = await loadPaymentOrder(orderId)
    if (!data) return NextResponse.json({ error: { message: 'Order not found.' } }, { status: 404 })
    const session = await getSession()
    if (data.order.userId ? data.order.userId !== session?.user.id : data.order.idempotencyKey !== checkoutToken) return NextResponse.json({ error: { message: 'This order is not available.' } }, { status: 403 })
    return NextResponse.json({ data: paymentSummary(data) }, { headers: { 'cache-control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Payment status is unavailable.' } }, { status: 400 })
  }
}
