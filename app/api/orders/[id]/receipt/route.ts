import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
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
  const shipping = (order.shippingAddress || {}) as Record<string, string>
  let paymentMetadata = (payment?.metadata || {}) as Record<string, unknown>
  if ((!paymentMetadata.cardBrand || !paymentMetadata.cardLast4) && payment?.provider === 'stripe' && payment.externalId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      const intent = await stripe.paymentIntents.retrieve(payment.externalId, { expand: ['latest_charge'] })
      const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null
      const card = charge?.payment_method_details?.card
      if (card?.brand && card.last4) paymentMetadata = { ...paymentMetadata, cardBrand: card.brand, cardLast4: card.last4 }
    } catch (error) { console.error('Historical Stripe receipt card details could not be loaded', { orderId: id, error }) }
  }
  const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice), 0)
  const customerName = [shipping.firstName, shipping.lastName].filter(Boolean).join(' ') || order.customerEmail
  const address = [shipping.address, shipping.addressLine2, shipping.city, shipping.state, shipping.postalCode, shipping.country].filter(Boolean).join(', ')
  const generatedAt = new Date().toISOString()
  const pdf = createReceiptPdf({
    storeName: settings.storeName,
    storeEmail: settings.storeEmail,
    storePhone: settings.storePhone,
    storeAddress: settings.address,
    orderNumber: order.orderNumber,
    orderDate: order.createdAt.toLocaleString('en-AU'),
    paymentDate: (payment?.updatedAt || order.updatedAt).toLocaleString('en-AU'),
    fulfilmentType: order.deliveryType === 'pickup' ? 'Pickup' : 'Delivery',
    receiptNumber: payment?.id || order.id,
    paymentStatus: order.paymentStatus,
    customerName,
    customerEmail: order.customerEmail,
    shippingAddress: address,
    stripePaymentIntentId: payment?.externalId || 'Not recorded',
    cardBrand: typeof paymentMetadata.cardBrand === 'string' ? paymentMetadata.cardBrand : 'Not recorded',
    cardLast4: typeof paymentMetadata.cardLast4 === 'string' ? paymentMetadata.cardLast4 : 'Not recorded',
    currency: order.currency,
    items: items.map((item) => {
      const product = productRows.find((row) => row.id === item.productId)
      const specs = (item.specifications || {}) as Record<string, string>
      return { name: product?.name || specs.productName || 'Product', sku: product?.sku || specs.sku || 'Unavailable', size: specs.sizeLabel || specs.variant || 'Standard', options: [specs.sideMode === 'double' ? 'Double-sided' : 'Single-sided', specs.designSource?.replaceAll('_', ' ')].filter(Boolean).join(' / '), quantity: item.quantity, unitPrice: Number(item.unitPrice), lineTotal: Number(item.totalPrice) }
    }),
    subtotal,
    discount: Number(order.discountAmount || 0),
    tax: Number(order.taxAmount),
    shipping: Number(order.shippingAmount),
    total: Number(order.totalAmount),
    generatedAt: new Date(generatedAt).toLocaleString('en-AU'),
  })
  return new NextResponse(pdf, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${order.orderNumber}-receipt.pdf"`, 'cache-control': 'private, no-store' } })
}
