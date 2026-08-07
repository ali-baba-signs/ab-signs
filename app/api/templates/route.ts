import { NextResponse } from 'next/server'
import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { products, productTemplateSizePrices, templateSizes, templates } from '@/lib/db/schema'

export async function GET() {
  try {
    const rows = await db.select().from(templates).where(eq(templates.status, 'active')).orderBy(asc(templates.name))
    const valid = rows.filter((row) => row.conversionStatus === 'ready' && row.previewImageUrl && row.canvasData && row.svgAssetId)
    const ids = valid.map((row) => row.id)
    const [sizes, productRows] = ids.length ? await Promise.all([
      db.select().from(templateSizes).where(inArray(templateSizes.templateId, ids)).orderBy(asc(templateSizes.displayOrder)),
      db.select({ id: products.id, name: products.name, templateId: products.templateId, active: products.active }).from(products).where(inArray(products.templateId, ids)),
    ]) : [[], []]
    const productIds = productRows.filter((row) => row.active).map((row) => row.id)
    const prices = productIds.length ? await db.select().from(productTemplateSizePrices).where(inArray(productTemplateSizePrices.productId, productIds)) : []
    return NextResponse.json({ data: { templates: valid.map((row) => ({
      id: row.id, name: row.name, description: row.description, category: row.category, previewUrl: row.previewImageUrl,
      version: row.templateVersion, logicalCanvasWidth: row.logicalCanvasWidth, logicalCanvasHeight: row.logicalCanvasHeight,
      sizes: sizes.filter((size) => size.templateId === row.id && size.enabled),
      products: productRows.filter((product) => product.templateId === row.id && product.active).map((product) => ({ ...product, prices: prices.filter((price) => price.productId === product.id && price.enabled) })),
    })) } }, { headers: { 'cache-control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Public template listing failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATES_LOAD_FAILED', message: 'Design Online templates could not be loaded.' } }, { status: 500 })
  }
}
