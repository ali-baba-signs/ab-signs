import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, customerArtworks, designs, orderEmailEvents, orderItems, orderStatusHistory, orders, paymentRecords, products, storageAssets, templates } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { assertTransition, deadlineState } from '@/lib/orders/workflow'
import { createPresignedDownloadUrl } from '@/lib/storage/r2'
import { deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { deliverOrderEmailEvent } from '@/lib/orders/emails'

async function details(id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return null
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id))
  const productIds = items.map((item) => item.productId)
  const artworkIds = items.flatMap((item) => item.customerArtworkId ? [item.customerArtworkId] : [])
  const designIds = items.flatMap((item) => item.designId ? [item.designId] : [])
  const assetIds = [...new Set(items.flatMap((item) => [item.previewAssetId, item.frontPreviewAssetId, item.backPreviewAssetId, item.productionAssetId, item.customerArtworkAssetId].filter((value): value is string => Boolean(value))))]
  const templateIds = [...new Set(items.flatMap((item) => item.templateId ? [item.templateId] : []))]
  const [productRows, history, payments, artworks, designRows, snapshotAssets, templateRows] = await Promise.all([
    productIds.length ? db.select().from(products).where(inArray(products.id, productIds)) : [],
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, id)).orderBy(asc(orderStatusHistory.changedAt)),
    db.select().from(paymentRecords).where(eq(paymentRecords.orderId, id)),
    artworkIds.length ? db.select({ artwork: customerArtworks, asset: storageAssets }).from(customerArtworks).innerJoin(storageAssets, eq(customerArtworks.assetId, storageAssets.id)).where(inArray(customerArtworks.id, artworkIds)) : [],
    designIds.length ? db.select().from(designs).where(inArray(designs.id, designIds)) : [],
    assetIds.length ? db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds)) : [],
    templateIds.length ? db.select({ id: templates.id, name: templates.name }).from(templates).where(inArray(templates.id, templateIds)) : [],
  ])
  const artworkDetails = new Map(await Promise.all(artworks.map(async (row) => [row.artwork.id, { ...row.artwork, contentType: row.asset.contentType, fileSize: row.asset.size, originalUrl: await createPresignedDownloadUrl(row.asset.objectKey), previewUrl: ['image/png','image/svg+xml','application/pdf'].includes(row.asset.contentType) ? `/api/artwork/preview?id=${row.artwork.id}` : null }] as const)))
  const designUrls = new Map(await Promise.all(designRows.map(async (row) => { const key = (row.canvasData as Record<string, unknown>)?.assetKey; return [row.id, typeof key === 'string' && key.startsWith('uploads/designs/') ? await createPresignedDownloadUrl(key) : null] as const })))
  const assetUrls = new Map(await Promise.all(snapshotAssets.map(async (asset) => [asset.id, await createPresignedDownloadUrl(asset.objectKey)] as const)))
  return { ...order, deadline: deadlineState(order.designConfirmationDeadline, order.designConfirmedAt), items: items.map((item) => {
    const artwork = item.customerArtworkId ? artworkDetails.get(item.customerArtworkId) : null
    const specs = item.specifications as Record<string, unknown> | null
    const expectedRatio = Number(specs?.width) / Number(specs?.height)
    const sourceRatio = artwork?.sourceWidthPx && artwork.sourceHeightPx ? artwork.sourceWidthPx / artwork.sourceHeightPx : 0
    const dimensionWarning = expectedRatio > 0 && sourceRatio > 0 && Math.abs(expectedRatio - sourceRatio) / expectedRatio > 0.05 ? 'Uploaded artwork aspect ratio differs from the ordered production size. Review before printing.' : null
    return { ...item, product: productRows.find((product) => product.id === item.productId), template: templateRows.find((template) => template.id === item.templateId) || null, artwork: artwork ? { ...artwork, dimensionWarning } : null, designUrl: item.designId ? designUrls.get(item.designId) : null, productionPreviewUrl: item.frontPreviewAssetId ? assetUrls.get(item.frontPreviewAssetId) : item.previewAssetId ? assetUrls.get(item.previewAssetId) : null, productionUrl: item.designId ? `/api/admin/orders/${id}/items/${item.id}/production?side=front&format=pdf` : null, productionSvgUrl: item.designId ? `/api/admin/orders/${id}/items/${item.id}/production?side=front&format=svg` : null, backProductionPreviewUrl: item.backPreviewAssetId ? assetUrls.get(item.backPreviewAssetId) : null, backProductionUrl: item.designId && (specs?.sideMode === 'double') ? `/api/admin/orders/${id}/items/${item.id}/production?side=back&format=pdf` : null, backProductionSvgUrl: item.designId && (specs?.sideMode === 'double') ? `/api/admin/orders/${id}/items/${item.id}/production?side=back&format=svg` : null }
  }), history, payments }
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  const result = await details((await context.params).id)
  return result ? NextResponse.json({ data: { order: result } }) : NextResponse.json({ error: { message: 'Order not found.' } }, { status: 404 })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  try {
    const body = await request.json() as Record<string, unknown>
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
    if (!order) throw new Error('Order not found.')
    const nextStatus = body.status && body.status !== order.status ? assertTransition(order.status, body.status) : order.status
    const now = new Date()
    const confirming = nextStatus === 'design_confirmed' && order.status !== 'design_confirmed'
    const date = (value: unknown, label: string) => { if (value === '' || value === null || value === undefined) return null; if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid date and time.`); return new Date(value) }
    const paymentStatuses = new Set(['awaiting_payment','paid','payment_failed','cancelled','refunded'])
    const requestedPaymentStatus = Object.hasOwn(body, 'paymentStatus') ? body.paymentStatus : order.paymentStatus
    if (typeof requestedPaymentStatus !== 'string' || !paymentStatuses.has(requestedPaymentStatus)) throw new Error('Select a valid payment status.')
    const receiptAssetId = Object.hasOwn(body, 'receiptAssetId') ? typeof body.receiptAssetId === 'string' && body.receiptAssetId ? body.receiptAssetId : null : order.receiptAssetId
    if (receiptAssetId) { const [receipt] = await db.select().from(storageAssets).where(eq(storageAssets.id, receiptAssetId)).limit(1); if (!receipt || receipt.contentType !== 'application/pdf') throw new Error('Payment receipt must be a registered PDF asset.') }
    const deliveryType = Object.hasOwn(body, 'deliveryType') ? body.deliveryType : order.deliveryType
    if (!['delivery', 'pickup'].includes(String(deliveryType))) throw new Error('Select delivery or pickup.')
    const [oldReceipt] = order.receiptAssetId && order.receiptAssetId !== receiptAssetId ? await db.select().from(storageAssets).where(eq(storageAssets.id, order.receiptAssetId)).limit(1) : []
    const result = await db.transaction(async (tx) => {
      const updates: Partial<typeof orders.$inferInsert> = {
        status: nextStatus,
        paymentStatus: nextStatus === 'payment_confirmed' ? 'paid' : requestedPaymentStatus,
        receiptAssetId,
        deliveryType: String(deliveryType),
        updatedAt: now,
      }
      if (nextStatus === 'dispatched' && !order.dispatchedAt) updates.dispatchedAt = now
      if (nextStatus === 'delivered' && !order.deliveredAt) { updates.deliveredAt = now; updates.deliveredByAdminId = session.user.id; updates.deliveryNote = typeof body.customerNote === 'string' ? body.customerNote.trim().slice(0, 2000) || null : null }
      if (nextStatus === 'ready_for_pickup' && !order.readyForPickupAt) updates.readyForPickupAt = now
      if (nextStatus === 'completed' && deliveryType === 'pickup' && !order.pickupCompletedAt) updates.pickupCompletedAt = now
      if (confirming && !order.designConfirmedAt) { updates.designConfirmedAt = now; updates.designConfirmationOnTime = order.designConfirmationDeadline ? now <= order.designConfirmationDeadline : null }
      if (Object.hasOwn(body,'delayReason')) updates.designDelayReason = typeof body.delayReason === 'string' ? body.delayReason.trim().slice(0,2000) || null : null
      if (Object.hasOwn(body,'expectedPrintingAt')) updates.expectedPrintingAt = date(body.expectedPrintingAt, 'Expected printing')
      if (Object.hasOwn(body,'expectedDeliveryAt')) updates.expectedDeliveryAt = date(body.expectedDeliveryAt, 'Expected delivery')
      if (Object.hasOwn(body,'expectedPickupAt')) updates.expectedPickupAt = date(body.expectedPickupAt, 'Expected pickup')
      if (deliveryType === 'delivery' && Object.hasOwn(body,'courierName')) updates.courierName = typeof body.courierName === 'string' ? body.courierName.trim().slice(0,120) || null : null
      if (deliveryType === 'delivery' && Object.hasOwn(body,'trackingNumber')) updates.trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim().slice(0,160) || null : null
      if (deliveryType === 'pickup') { updates.courierName = null; updates.trackingNumber = null }
      if (Object.hasOwn(body,'internalNote')) updates.internalNotes = typeof body.internalNote === 'string' ? body.internalNote.trim().slice(0,5000) || null : null
      if (Object.hasOwn(body,'customerNote')) updates.customerNotes = typeof body.customerNote === 'string' ? body.customerNote.trim().slice(0,5000) || null : null
      const rows = await tx.update(orders).set(updates).where(eq(orders.id, id)).returning()
      if (nextStatus !== order.status) await tx.insert(orderStatusHistory).values({ orderId: id, status: nextStatus, previousStatus: order.status, newStatus: nextStatus, changedByAdmin: session.user.id, notes: typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : null, internalNote: typeof body.internalNote === 'string' ? body.internalNote.trim().slice(0, 5000) : null, customerVisibleNote: typeof body.customerNote === 'string' ? body.customerNote.trim().slice(0, 5000) : null, expectedCompletionAt: date(body.expectedCompletionAt, 'Expected completion'), actualCompletionAt: now })
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: nextStatus !== order.status ? 'order.status_changed' : receiptAssetId !== order.receiptAssetId ? 'order.receipt_uploaded' : 'order.updated', entityType: 'order', entityId: id, entityName: order.orderNumber, description: nextStatus !== order.status ? `Changed ${order.orderNumber} from ${order.status} to ${nextStatus}.` : receiptAssetId !== order.receiptAssetId ? `Attached a payment receipt to ${order.orderNumber}.` : `Updated order ${order.orderNumber}.`, metadata: { previousStatus: order.status, newStatus: nextStatus } }))
      let emailEventId: string | null = null
      if (['delivered', 'completed'].includes(nextStatus) && nextStatus !== order.status) {
        const claimed = await tx.insert(orderEmailEvents).values({ orderId: id, eventType: 'order_completed', status: 'processing' }).onConflictDoNothing().returning({ id: orderEmailEvents.id })
        emailEventId = claimed[0]?.id || null
      } else if (['delivered', 'completed'].includes(nextStatus)) {
        const staleBefore = new Date(now.getTime() - 5 * 60 * 1000)
        const retried = await tx.update(orderEmailEvents).set({ status: 'processing', attempts: sql`${orderEmailEvents.attempts} + 1`, error: null, updatedAt: now }).where(and(eq(orderEmailEvents.orderId, id), eq(orderEmailEvents.eventType, 'order_completed'), or(eq(orderEmailEvents.status, 'failed'), and(eq(orderEmailEvents.status, 'processing'), lt(orderEmailEvents.updatedAt, staleBefore))))).returning({ id: orderEmailEvents.id })
        emailEventId = retried[0]?.id || null
      }
      return { updated: rows[0], emailEventId }
    })
    if (oldReceipt) await deleteAssetIfOrphaned(oldReceipt.objectKey)
    if (result.emailEventId) await deliverOrderEmailEvent(result.emailEventId)
    return NextResponse.json({ data: { order: result.updated, details: await details(id) } })
  } catch (error) { console.error('Admin order update failed', { orderId: id, error }); const actionable = error instanceof Error && /Select a valid|cannot transition|must be a valid|not found|registered PDF/i.test(error.message) ? error.message : 'Order could not be updated. The server rejected the requested status or payment change.'; return NextResponse.json({ error: { code: 'ORDER_UPDATE_FAILED', message: actionable } }, { status: 400 }) }
}
