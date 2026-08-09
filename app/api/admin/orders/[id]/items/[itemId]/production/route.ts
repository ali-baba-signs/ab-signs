import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { designs, orderItems, orders, templateSizes } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { renderProductionDesign } from '@/lib/production/design-render'

export const runtime = 'nodejs'

const unitToMm: Record<string, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8, m: 1000 }

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  const { id, itemId } = await context.params
  try {
    const [item] = await db.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, id))).limit(1)
    if (!item?.designId || item.designSource !== 'online_editor') return NextResponse.json({ error: { message: 'This order item does not have an online-editor production design.' } }, { status: 404 })
    const [[order], [design], sizeRows] = await Promise.all([
      db.select({ orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, id)).limit(1),
      db.select().from(designs).where(eq(designs.id, item.designId)).limit(1),
      item.templateSizeId ? db.select().from(templateSizes).where(eq(templateSizes.id, item.templateSizeId)).limit(1) : Promise.resolve([]),
    ])
    if (!order || !design) return NextResponse.json({ error: { message: 'The saved production design could not be found.' } }, { status: 404 })
    const specs = item.specifications && typeof item.specifications === 'object' ? item.specifications as Record<string, unknown> : {}
    const unit = String(specs.unit || sizeRows[0]?.unit || 'mm')
    const factor = unitToMm[unit] || 1
    const widthMm = Number(specs.width || sizeRows[0]?.width) * factor
    const heightMm = Number(specs.height || sizeRows[0]?.height) * factor
    if (!(widthMm > 0 && heightMm > 0)) throw new Error('The historical order item is missing valid production dimensions.')
    const side = request.nextUrl.searchParams.get('side') === 'back' ? 'back' : 'front'
    const output = await renderProductionDesign(design.canvasData as Record<string, unknown>, { side, widthMm, heightMm, bleedMm: Number(sizeRows[0]?.bleed ?? specs.bleedMm ?? 3), trimMarks: sizeRows[0]?.trimMarks ?? specs.trimMarks !== false })
    const format = request.nextUrl.searchParams.get('format') === 'png' ? 'png' : 'pdf'
    const filename = `${order.orderNumber}-${item.id.slice(0,8)}-${side}-production.${format}`
    return new NextResponse(format === 'png' ? output.preview : output.pdf, { headers: { 'content-type': format === 'png' ? 'image/png' : 'application/pdf', 'content-disposition': `${format === 'png' ? 'inline' : 'attachment'}; filename="${filename}"`, 'cache-control': 'private, no-store', 'x-print-metadata': Buffer.from(JSON.stringify(output.metadata)).toString('base64url') } })
  } catch (error) {
    console.error('Production render failed', { orderId: id, itemId, error })
    return NextResponse.json({ error: { message: error instanceof Error && /missing|Back artwork/i.test(error.message) ? error.message : 'The production file could not be rendered. Check the saved design assets and retry.' } }, { status: 422 })
  }
}
