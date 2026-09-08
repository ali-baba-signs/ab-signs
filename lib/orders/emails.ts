import 'server-only'

import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orderEmailEvents, orderItems, orders, storageAssets } from '@/lib/db/schema'
import { sendTransactionalEmail } from '@/lib/contact/mailer'
import { createPresignedDownloadUrl } from '@/lib/storage/r2'
import { normalizeOrderStatus, ORDER_STATUS_LABELS } from '@/lib/orders/workflow'
import { getAuthBaseURL } from '@/lib/auth/origins'

export type OrderEmailType = 'order_confirmation' | 'order_completed' | 'order_update'

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!)
}

function money(value: unknown, currency: string) {
  return `${currency} ${Number(value || 0).toFixed(2)}`
}

function siteUrl() {
  const configured = getAuthBaseURL()
  if (!configured) throw new Error('BETTER_AUTH_URL or NEXT_PUBLIC_SITE_URL is required to create order email links.')
  return configured
}

async function emailData(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) throw new Error('Order email cannot be prepared because the order no longer exists.')
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  const assetIds = [...new Set(items.flatMap((item) => [item.frontPreviewAssetId, item.previewAssetId].filter((id): id is string => Boolean(id))))]
  const assets = assetIds.length ? await db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds)) : []
  const urls = new Map(await Promise.all(assets.map(async (asset) => [asset.id, await createPresignedDownloadUrl(asset.objectKey)] as const)))
  return { order, items: items.map((item) => ({ ...item, previewUrl: item.frontPreviewAssetId ? urls.get(item.frontPreviewAssetId) : item.previewAssetId ? urls.get(item.previewAssetId) : null })) }
}

async function sendOrderConfirmation(orderId: string) {
  const { order, items } = await emailData(orderId)
  const address = (order.shippingAddress || {}) as Record<string, string>
  const customerName = [address.firstName, address.lastName].filter(Boolean).join(' ') || 'Customer'
  const subtotal = Number(order.totalAmount) - Number(order.shippingAmount) - Number(order.taxAmount) + Number(order.discountAmount)
  const lines = items.map((item) => {
    const specs = (item.specifications || {}) as Record<string, string>
    const preview = item.previewUrl ? `\nArtwork preview: ${item.previewUrl}` : ''
    return `${specs.productName || 'Product'}${specs.sku ? ` (SKU ${specs.sku})` : ''} — ${specs.sizeLabel || specs.variant || 'Standard'} × ${item.quantity} at ${money(item.unitPrice, order.currency)} each: ${money(item.totalPrice, order.currency)}${preview}`
  })
  const rows = items.map((item) => {
    const specs = (item.specifications || {}) as Record<string, string>
    const previews = [[specs.productImage, 'Product'], [item.previewUrl, 'Your design']].filter(([url]) => Boolean(url))
    return `<tr><td style="padding:12px;border-bottom:1px solid #ddd">${previews.map(([url, label]) => `<div style="display:inline-block;margin-right:8px;text-align:center"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)} preview" width="90" style="max-width:90px;height:auto"><br><small>${escapeHtml(label)}</small></div>`).join('')}</td><td style="padding:12px;border-bottom:1px solid #ddd"><strong>${escapeHtml(specs.productName || 'Product')}</strong>${specs.sku ? `<br>SKU: ${escapeHtml(specs.sku)}` : ''}<br>${escapeHtml(specs.sizeLabel || specs.variant || 'Standard')}<br>Quantity: ${item.quantity}<br>${escapeHtml(money(item.unitPrice, order.currency))} each${item.designId ? `<br>Design: ${escapeHtml(item.designId)}` : ''}${item.templateId ? `<br>Template: ${escapeHtml(item.templateId)}` : ''}</td><td style="padding:12px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(money(item.totalPrice, order.currency))}</td></tr>`
  }).join('')
  return sendTransactionalEmail({
    to: order.customerEmail,
    subject: `Order received — ${order.orderNumber} — pending confirmation`,
    text: `Hi ${customerName},\n\nWe received payment for order ${order.orderNumber}, placed ${order.createdAt.toLocaleString('en-AU')}.\nStatus: Payment confirmed; production review pending.\n\n${lines.join('\n')}\n\nSubtotal: ${money(subtotal, order.currency)}\nDiscount: ${money(order.discountAmount, order.currency)}\nShipping: ${money(order.shippingAmount, order.currency)}\nGST / tax: ${money(order.taxAmount, order.currency)}\nTotal paid: ${money(order.totalAmount, order.currency)}\n\nNext steps: our team will review the artwork and confirm the production schedule. We will email you when the order status changes.`,
    html: `<h1>Order received</h1><p>Hi ${escapeHtml(customerName)},</p><p>We received payment for order <strong>${escapeHtml(order.orderNumber)}</strong>, placed ${escapeHtml(order.createdAt.toLocaleString('en-AU'))}.</p><p><strong>Status:</strong> Payment confirmed; production review pending.</p><table style="width:100%;border-collapse:collapse">${rows}</table><p>Subtotal: ${escapeHtml(money(subtotal, order.currency))}<br>Discount: ${escapeHtml(money(order.discountAmount, order.currency))}<br>Shipping: ${escapeHtml(money(order.shippingAmount, order.currency))}<br>GST / tax: ${escapeHtml(money(order.taxAmount, order.currency))}<br><strong>Total paid: ${escapeHtml(money(order.totalAmount, order.currency))}</strong></p><h2>Next steps</h2><p>Our team will review the artwork and confirm the production schedule. We will email you when the order status changes.</p>`,
  })
}

async function sendOrderUpdate(orderId: string, payload: Record<string, unknown>) {
  const { order } = await emailData(orderId)
  const address = (order.shippingAddress || {}) as Record<string, string>
  const customerName = [address.firstName, address.lastName].filter(Boolean).join(' ') || 'Customer'
  const status = ORDER_STATUS_LABELS[normalizeOrderStatus(String(payload.status || order.status))]
  const note = typeof payload.customerNote === 'string' ? payload.customerNote.trim() : ''
  const accountUrl = `${siteUrl()}/account/orders/${order.id}`
  return sendTransactionalEmail({
    to: order.customerEmail,
    subject: `Update for ${order.orderNumber}: ${status}`,
    text: `Hi ${customerName},\n\nYour order ${order.orderNumber} has been updated.\nStatus: ${status}${note ? `\nNote from our team: ${note}` : ''}\n\nView the latest order details: ${accountUrl}`,
    html: `<h1>Order update</h1><p>Hi ${escapeHtml(customerName)},</p><p>Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been updated.</p><p><strong>Status:</strong> ${escapeHtml(status)}</p>${note ? `<p><strong>Note from our team:</strong><br>${escapeHtml(note).replace(/\r?\n/g, '<br>')}</p>` : ''}<p><a href="${escapeHtml(accountUrl)}">View the latest order details</a></p>`,
  })
}

async function sendOrderCompleted(orderId: string) {
  const { order, items } = await emailData(orderId)
  const address = (order.shippingAddress || {}) as Record<string, string>
  const customerName = [address.firstName, address.lastName].filter(Boolean).join(' ') || 'Customer'
  const reviewLinks = items.map((item) => `${siteUrl()}/account/orders/${order.id}/review?itemId=${item.id}`)
  const itemLines = items.map((item) => { const specs = (item.specifications || {}) as Record<string, string>; return `${specs.productName || 'Product'}${specs.sku ? ` (SKU ${specs.sku})` : ''} — ${specs.sizeLabel || specs.variant || 'Standard'} × ${item.quantity}` })
  const delivery = order.deliveryType === 'pickup'
    ? 'Your order has been completed and collected.'
    : `Your order has been completed${order.trackingNumber ? ` (tracking ${order.trackingNumber})` : ''}.`
  return sendTransactionalEmail({
    to: order.customerEmail,
    subject: `${order.orderNumber} is ${order.status === 'delivered' ? 'delivered' : 'complete'} — Ali Baba Signs`,
    text: `Hi ${customerName},\n\n${delivery}\n\nOrder: ${order.orderNumber}\n${itemLines.join('\n')}\n${order.deliveryNote || order.customerNotes || ''}\n\nReview your purchase:\n${reviewLinks.join('\n')}`,
    html: `<h1>${order.status === 'delivered' ? 'Your order has been delivered' : 'Your order is complete'}</h1><p>Hi ${escapeHtml(customerName)},</p><p>${escapeHtml(delivery)}</p><p><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</p><ul>${itemLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>${order.deliveryNote || order.customerNotes ? `<p>${escapeHtml(order.deliveryNote || order.customerNotes)}</p>` : ''}<h2>Tell us how we did</h2>${reviewLinks.map((link, index) => `<p><a href="${escapeHtml(link)}">Review item ${index + 1}</a></p>`).join('')}`,
  })
}

/** Delivers a previously claimed event. Failures are recorded and never roll back order state. */
export async function deliverOrderEmailEvent(eventId: string) {
  const [event] = await db.select().from(orderEmailEvents).where(eq(orderEmailEvents.id, eventId)).limit(1)
  if (!event || event.status !== 'processing') return { sent: false, skipped: true }
  try {
    let messageId: string | null
    if (event.eventType === 'order_confirmation') messageId = await sendOrderConfirmation(event.orderId)
    else if (event.eventType === 'order_completed') messageId = await sendOrderCompleted(event.orderId)
    else if (event.eventType === 'order_update') messageId = await sendOrderUpdate(event.orderId, (event.payload || {}) as Record<string, unknown>)
    else throw new Error('Unknown order email event type.')
    await db.update(orderEmailEvents).set({ status: 'sent', providerMessageId: messageId, sentAt: new Date(), error: null, updatedAt: new Date() }).where(eq(orderEmailEvents.id, event.id))
    return { sent: true, skipped: false }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : 'Order email delivery failed.'
    await db.update(orderEmailEvents).set({ status: 'failed', error: message, updatedAt: new Date() }).where(eq(orderEmailEvents.id, event.id))
    console.error('Order email delivery failed', { orderId: event.orderId, eventType: event.eventType, error: message })
    return { sent: false, skipped: false, error: message }
  }
}
