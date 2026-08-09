import { NextRequest, NextResponse } from 'next/server'
import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, customerArtworks, designs, orderItems, orderStatusHistory, orders, paymentRecords, products, storageAssets } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { assertTransition, deadlineState } from '@/lib/orders/workflow'
import { createPresignedDownloadUrl } from '@/lib/storage/r2'
import { deleteAssetIfOrphaned } from '@/lib/storage/asset-records'

async function details(id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return null
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id))
  const productIds = items.map((item) => item.productId)
  const artworkIds = items.flatMap((item) => item.customerArtworkId ? [item.customerArtworkId] : [])
  const designIds = items.flatMap((item) => item.designId ? [item.designId] : [])
  const [productRows, history, payments, artworks, designRows] = await Promise.all([
    productIds.length ? db.select().from(products).where(inArray(products.id, productIds)) : [],
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, id)).orderBy(asc(orderStatusHistory.changedAt)),
    db.select().from(paymentRecords).where(eq(paymentRecords.orderId, id)),
    artworkIds.length ? db.select({ artwork: customerArtworks, asset: storageAssets }).from(customerArtworks).innerJoin(storageAssets, eq(customerArtworks.assetId, storageAssets.id)).where(inArray(customerArtworks.id, artworkIds)) : [],
    designIds.length ? db.select().from(designs).where(inArray(designs.id, designIds)) : [],
  ])
  const artworkDetails = new Map(await Promise.all(artworks.map(async (row) => [row.artwork.id, { ...row.artwork, contentType: row.asset.contentType, fileSize: row.asset.size, originalUrl: await createPresignedDownloadUrl(row.asset.objectKey), previewUrl: ['image/png','image/svg+xml','application/pdf'].includes(row.asset.contentType) ? `/api/artwork/preview?id=${row.artwork.id}` : null }] as const)))
  const designUrls = new Map(await Promise.all(designRows.map(async (row) => { const key = (row.canvasData as Record<string, unknown>)?.assetKey; return [row.id, typeof key === 'string' && key.startsWith('uploads/designs/') ? await createPresignedDownloadUrl(key) : null] as const })))
  return { ...order, deadline: deadlineState(order.designConfirmationDeadline, order.designConfirmedAt), items: items.map((item) => {
    const artwork = item.customerArtworkId ? artworkDetails.get(item.customerArtworkId) : null
    const specs = item.specifications as Record<string, unknown> | null
    const expectedRatio = Number(specs?.width) / Number(specs?.height)
    const sourceRatio = artwork?.sourceWidthPx && artwork.sourceHeightPx ? artwork.sourceWidthPx / artwork.sourceHeightPx : 0
    const dimensionWarning = expectedRatio > 0 && sourceRatio > 0 && Math.abs(expectedRatio - sourceRatio) / expectedRatio > 0.05 ? 'Uploaded artwork aspect ratio differs from the ordered production size. Review before printing.' : null
    return { ...item, product: productRows.find((product) => product.id === item.productId), artwork: artwork ? { ...artwork, dimensionWarning } : null, designUrl: item.designId ? designUrls.get(item.designId) : null, productionPreviewUrl: item.designId ? `/api/admin/orders/${id}/items/${item.id}/production?format=png&side=front` : null, productionUrl: item.designId ? `/api/admin/orders/${id}/items/${item.id}/production?side=front` : null, backProductionPreviewUrl: item.designId && specs?.sideMode === 'double' ? `/api/admin/orders/${id}/items/${item.id}/production?format=png&side=back` : null, backProductionUrl: item.designId && specs?.sideMode === 'double' ? `/api/admin/orders/${id}/items/${item.id}/production?side=back` : null }
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
    const [oldReceipt] = order.receiptAssetId && order.receiptAssetId !== receiptAssetId ? await db.select().from(storageAssets).where(eq(storageAssets.id, order.receiptAssetId)).limit(1) : []
    const [updated] = await db.transaction(async (tx) => {
      const updates: Partial<typeof orders.$inferInsert> = {
        status: nextStatus,
        paymentStatus: nextStatus === 'payment_confirmed' ? 'paid' : requestedPaymentStatus,
        receiptAssetId,
        updatedAt: now,
      }
      if (confirming && !order.designConfirmedAt) { updates.designConfirmedAt = now; updates.designConfirmationOnTime = order.designConfirmationDeadline ? now <= order.designConfirmationDeadline : null }
      if (Object.hasOwn(body,'delayReason')) updates.designDelayReason = typeof body.delayReason === 'string' ? body.delayReason.trim().slice(0,2000) || null : null
      if (Object.hasOwn(body,'expectedPrintingAt')) updates.expectedPrintingAt = date(body.expectedPrintingAt, 'Expected printing')
      if (Object.hasOwn(body,'expectedDeliveryAt')) updates.expectedDeliveryAt = date(body.expectedDeliveryAt, 'Expected delivery')
      if (Object.hasOwn(body,'courierName')) updates.courierName = typeof body.courierName === 'string' ? body.courierName.trim().slice(0,120) || null : null
      if (Object.hasOwn(body,'trackingNumber')) updates.trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim().slice(0,160) || null : null
      if (Object.hasOwn(body,'internalNote')) updates.internalNotes = typeof body.internalNote === 'string' ? body.internalNote.trim().slice(0,5000) || null : null
      if (Object.hasOwn(body,'customerNote')) updates.customerNotes = typeof body.customerNote === 'string' ? body.customerNote.trim().slice(0,5000) || null : null
      const rows = await tx.update(orders).set(updates).where(eq(orders.id, id)).returning()
      if (nextStatus !== order.status) await tx.insert(orderStatusHistory).values({ orderId: id, status: nextStatus, previousStatus: order.status, newStatus: nextStatus, changedByAdmin: session.user.id, notes: typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : null, internalNote: typeof body.internalNote === 'string' ? body.internalNote.trim().slice(0, 5000) : null, customerVisibleNote: typeof body.customerNote === 'string' ? body.customerNote.trim().slice(0, 5000) : null, expectedCompletionAt: date(body.expectedCompletionAt, 'Expected completion') })
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: nextStatus !== order.status ? 'order.status_changed' : receiptAssetId !== order.receiptAssetId ? 'order.receipt_uploaded' : 'order.updated', entityType: 'order', entityId: id, entityName: order.orderNumber, description: nextStatus !== order.status ? `Changed ${order.orderNumber} from ${order.status} to ${nextStatus}.` : receiptAssetId !== order.receiptAssetId ? `Attached a payment receipt to ${order.orderNumber}.` : `Updated order ${order.orderNumber}.`, metadata: { previousStatus: order.status, newStatus: nextStatus } }))
      return rows
    })
    if (oldReceipt) await deleteAssetIfOrphaned(oldReceipt.objectKey)
    return NextResponse.json({ data: { order: updated, details: await details(id) } })
  } catch (error) { console.error('Admin order update failed', { orderId: id, error }); const actionable = error instanceof Error && /Select a valid|cannot transition|must be a valid|not found|registered PDF/i.test(error.message) ? error.message : 'Order could not be updated. The server rejected the requested status or payment change.'; return NextResponse.json({ error: { code: 'ORDER_UPDATE_FAILED', message: actionable } }, { status: 400 }) }
}
