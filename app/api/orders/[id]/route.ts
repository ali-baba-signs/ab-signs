import { NextRequest, NextResponse } from 'next/server'
import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { customerArtworks, designs, orderItems, orderStatusHistory, orders, paymentRecords, products, storageAssets } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { createPresignedDownloadUrl } from '@/lib/storage/r2'
import { deadlineState } from '@/lib/orders/workflow'

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(); if (!session?.user) return NextResponse.json({ error: { message: 'Sign in to view this order.' } }, { status: 401 })
  const { id } = await context.params; const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: { message: 'Order not found.' } }, { status: 404 }); if (order.userId !== session.user.id) return NextResponse.json({ error: { message: 'You cannot view another customer’s order.' } }, { status: 403 })
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id)); const productIds = items.map((item) => item.productId); const artworkIds = items.flatMap((item) => item.customerArtworkId ? [item.customerArtworkId] : []); const designIds = items.flatMap((item) => item.designId ? [item.designId] : [])
  const [productRows, history, payments, artworks, designRows] = await Promise.all([productIds.length ? db.select().from(products).where(inArray(products.id, productIds)) : [], db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, id)).orderBy(asc(orderStatusHistory.changedAt)), db.select().from(paymentRecords).where(eq(paymentRecords.orderId, id)), artworkIds.length ? db.select({ artwork: customerArtworks, asset: storageAssets }).from(customerArtworks).innerJoin(storageAssets, eq(customerArtworks.assetId, storageAssets.id)).where(inArray(customerArtworks.id, artworkIds)) : [], designIds.length ? db.select().from(designs).where(inArray(designs.id, designIds)) : []])
  const urls = new Map(await Promise.all(artworks.map(async (row) => [row.artwork.id, await createPresignedDownloadUrl(row.asset.objectKey)] as const)))
  const designUrls = new Map(await Promise.all(designRows.map(async (row) => { const key = (row.canvasData as Record<string, unknown>)?.assetKey; return [row.id, typeof key === 'string' && key.startsWith('uploads/designs/') ? await createPresignedDownloadUrl(key) : null] as const })))
  return NextResponse.json({ data: { order: { ...order, internalNotes: undefined, deadline: deadlineState(order.designConfirmationDeadline, order.designConfirmedAt), items: items.map((item) => ({ ...item, product: productRows.find((product) => product.id === item.productId), artworkUrl: item.customerArtworkId ? urls.get(item.customerArtworkId) : null, designUrl: item.designId ? designUrls.get(item.designId) : null })), history: history.map(({ internalNote: _, ...row }) => row), payments } } }, { headers: { 'cache-control': 'private, no-store' } })
}
