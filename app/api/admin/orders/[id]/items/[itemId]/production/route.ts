import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { designs, orderItems, orders, storageAssets } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { getObjectBody } from '@/lib/storage/r2'
import { designToSvg } from '@/lib/production/design-svg'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  const { id, itemId } = await context.params
  try {
    const [item] = await db.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, id))).limit(1)
    if (!item?.designId || item.designSource !== 'online_editor') return NextResponse.json({ error: { message: 'This order item does not have an online-editor production design.' } }, { status: 404 })
    const [[order], [design]] = await Promise.all([
      db.select({ orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, id)).limit(1),
      db.select().from(designs).where(eq(designs.id, item.designId)).limit(1),
    ])
    if (!order || !design) return NextResponse.json({ error: { message: 'The saved production design could not be found.' } }, { status: 404 })

    const side = request.nextUrl.searchParams.get('side') === 'back' ? 'back' : 'front'
    const requestedFormat = request.nextUrl.searchParams.get('format') || 'best'
    if (!['best', 'svg', 'pdf', 'png'].includes(requestedFormat)) return NextResponse.json({ error: { message: 'Choose SVG, PDF, or PNG production format.' } }, { status: 400 })
    if (requestedFormat === 'best' || requestedFormat === 'svg') {
      try {
        const svg = designToSvg(design.canvasData, side)
        const filename = `${order.orderNumber}-${item.id.slice(0, 8)}-${side}-production.svg`
        return new NextResponse(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'content-disposition': `attachment; filename="${filename}"`, 'cache-control': 'private, no-store' } })
      } catch (error) {
        if (requestedFormat === 'svg') throw error
      }
    }
    const format = requestedFormat === 'png' ? 'png' : 'pdf'
    const renderedAssets = design.canvasData && typeof design.canvasData === 'object' && 'renderedAssets' in design.canvasData
      ? (design.canvasData as Record<string, unknown>).renderedAssets as Record<string, unknown>
      : {}
    const renderedSide = renderedAssets?.[side] && typeof renderedAssets[side] === 'object' ? renderedAssets[side] as Record<string, unknown> : {}
    const assetId = format === 'png'
      ? side === 'back' ? design.backPreviewAssetId : design.frontPreviewAssetId
      : side === 'front' ? design.productionAssetId : null
    const objectKey = format === 'pdf' && side === 'back' && typeof renderedSide.productionKey === 'string' ? renderedSide.productionKey : null
    const [asset] = assetId
      ? await db.select().from(storageAssets).where(eq(storageAssets.id, assetId)).limit(1)
      : objectKey ? await db.select().from(storageAssets).where(eq(storageAssets.objectKey, objectKey)).limit(1) : []
    if (!asset) throw new Error(`${side === 'back' ? 'Back' : 'Front'} ${format === 'pdf' ? 'production file' : 'preview'} is missing from this saved design.`)

    const body = await getObjectBody(asset.objectKey)
    const extension = asset.contentType === 'application/pdf' ? 'pdf' : asset.contentType === 'image/png' ? 'png' : 'jpg'
    const filename = `${order.orderNumber}-${item.id.slice(0, 8)}-${side}-production.${extension}`
    return new NextResponse(body, {
      headers: {
        'content-type': asset.contentType,
        'content-disposition': `${format === 'png' ? 'inline' : 'attachment'}; filename="${filename}"`,
        'cache-control': 'private, no-store',
        'x-print-metadata': Buffer.from(JSON.stringify(renderedSide.metadata || {})).toString('base64url'),
      },
    })
  } catch (error) {
    console.error('Stored production file retrieval failed', { orderId: id, itemId, error })
    return NextResponse.json({ error: { message: error instanceof Error && /missing/i.test(error.message) ? error.message : 'The production file could not be retrieved. Check the saved design assets and retry.' } }, { status: 422 })
  }
}
