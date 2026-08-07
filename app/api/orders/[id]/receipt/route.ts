import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orderItems, orders, paymentRecords, products, storageAssets } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { loadStoreSettings } from '@/lib/store/load-settings'
import { createReceiptPdf } from '@/lib/pdf/receipt'
import { createPresignedDownloadUrl } from '@/lib/storage/r2'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: { message: 'Sign in is required.' } }, { status: 401 })
  const { id } = await params
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: { message: 'Order not found.' } }, { status: 404 })
  if (order.userId !== session.user.id) return NextResponse.json({ error: { message: 'You cannot access another customer’s receipt.' } }, { status: 403 })
  if (order.paymentStatus !== 'paid') return NextResponse.json({ error: { message: 'A receipt is available after payment is confirmed.' } }, { status: 409 })
  if (order.receiptAssetId) {
    const [asset] = await db.select().from(storageAssets).where(eq(storageAssets.id, order.receiptAssetId)).limit(1)
    if (asset?.contentType === 'application/pdf') return NextResponse.redirect(await createPresignedDownloadUrl(asset.objectKey))
  }
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id))
  const productRows = items.length ? await db.select().from(products).where(inArray(products.id, items.map((item) => item.productId))) : []
  const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, id)).limit(1)
  const settings = await loadStoreSettings()
  const shipping = order.shippingAddress as Record<string, string>
  const billing = order.billingAddress as Record<string, string>
  const subtotal = Number(order.totalAmount) - Number(order.taxAmount) - Number(order.shippingAmount)
  const lines = [settings.storeName, settings.storeEmail, settings.storePhone, settings.address, '', 'PAYMENT RECEIPT', `Order: ${order.orderNumber}`, `Order date: ${order.createdAt.toISOString()}`, `Receipt generated: ${new Date().toISOString()}`, `Customer: ${order.customerEmail}`, `Billing address: ${Object.values(billing || {}).filter(Boolean).join(', ')}`, `Shipping address: ${Object.values(shipping || {}).filter(Boolean).join(', ')}`, '', 'ITEMS', ...items.map((item) => { const product = productRows.find((row) => row.id === item.productId); const specs = item.specifications as Record<string, string>; return `${product?.name || 'Product'} | ${specs?.sizeLabel || 'Standard'} | qty ${item.quantity} | ${order.currency} ${Number(item.totalPrice).toFixed(2)}` }), '', `Subtotal: ${order.currency} ${subtotal.toFixed(2)}`, `Discounts: ${order.currency} 0.00`, `Tax: ${order.currency} ${Number(order.taxAmount).toFixed(2)}`, `Shipping: ${order.currency} ${Number(order.shippingAmount).toFixed(2)}`, `Total: ${order.currency} ${Number(order.totalAmount).toFixed(2)}`, `Payment method: ${order.paymentMethod || payment?.provider || 'Not recorded'}`, `Payment status: ${order.paymentStatus}`, `Transaction reference: ${payment?.externalId || 'Not recorded'}`, `Payment date: ${payment?.updatedAt?.toISOString() || order.updatedAt.toISOString()}`]
  const pdf = createReceiptPdf(lines)
  return new NextResponse(pdf, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${order.orderNumber}-receipt.pdf"`, 'cache-control': 'private, no-store' } })
}
