import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orderItems, orders } from '@/lib/db/schema'
import { authoritativeTotalCents, moneyCents as cents } from './integrity'

export async function loadPaymentOrder(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return null
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  return { order, items }
}

export function assertAuthoritativeTotal(data: NonNullable<Awaited<ReturnType<typeof loadPaymentOrder>>>) {
  return authoritativeTotalCents({ itemTotals: data.items.map((item) => item.totalPrice), discount: data.order.discountAmount, shipping: data.order.shippingAmount, tax: data.order.taxAmount, total: data.order.totalAmount })
}

export function paymentSummary(data: NonNullable<Awaited<ReturnType<typeof loadPaymentOrder>>>) {
  const shipping = (data.order.shippingAddress || {}) as Record<string, string>
  const billing = (data.order.billingAddress || {}) as Record<string, string>
  return {
    orderId: data.order.id,
    orderNumber: data.order.orderNumber,
    paymentStatus: data.order.paymentStatus,
    orderStatus: data.order.status,
    customer: {
      email: data.order.customerEmail,
      name: [billing.firstName || shipping.firstName, billing.lastName || shipping.lastName].filter(Boolean).join(' '),
      address: {
        line1: billing.address || shipping.address || '',
        line2: billing.addressLine2 || shipping.addressLine2 || '',
        city: billing.city || shipping.city || '',
        state: billing.state || shipping.state || '',
        postal_code: billing.postalCode || shipping.postalCode || '',
        country: (() => { const country = billing.country || shipping.country || ''; return country.length === 2 ? country.toUpperCase() : /^australia$/i.test(country) ? 'AU' : '' })(),
      },
    },
    items: data.items.map((item) => {
      const specs = (item.specifications || {}) as Record<string, string>
      const designPreviewUrl = item.designId ? `/api/designs/${encodeURIComponent(item.designId)}/preview` : item.customerArtworkId ? `/api/artwork/preview?id=${encodeURIComponent(item.customerArtworkId)}` : null
      const productImageUrl = specs.productImage || null
      return {
        id: item.id,
        productId: item.productId,
        productName: specs.productName || 'Product',
        size: specs.sizeLabel || specs.variant || 'Standard',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        designId: item.designId,
        templateId: item.templateId,
        productImageUrl,
        designPreviewUrl,
        previewUrl: designPreviewUrl || productImageUrl,
        metadata: specs,
      }
    }),
    totals: {
      subtotal: (data.items.reduce((sum, item) => sum + cents(item.totalPrice), 0) / 100).toFixed(2),
      discount: Number(data.order.discountAmount).toFixed(2),
      couponCode: ((data.order.couponSnapshot || {}) as Record<string, unknown>).code || null,
      shipping: Number(data.order.shippingAmount).toFixed(2),
      tax: Number(data.order.taxAmount).toFixed(2),
      total: Number(data.order.totalAmount).toFixed(2),
      currency: data.order.currency,
    },
  }
}
