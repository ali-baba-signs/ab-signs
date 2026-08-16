import { NextResponse } from 'next/server'
import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { products, productTemplateSizePrices, templateSizes, templates } from '@/lib/db/schema'

export async function GET() {
  try {
    // Listing cards must never materialize the canonical Fabric JSON.
    const rows = await db.select({ id: templates.id, name: templates.name, description: templates.description, category: templates.category, previewImageUrl: templates.previewImageUrl, templateVersion: templates.templateVersion, logicalCanvasWidth: templates.logicalCanvasWidth, logicalCanvasHeight: templates.logicalCanvasHeight, conversionStatus: templates.conversionStatus, status: templates.status, updatedAt: templates.updatedAt }).from(templates).where(eq(templates.status, 'active')).orderBy(asc(templates.name))
    const valid = rows.filter((row) => row.conversionStatus === 'ready' && row.previewImageUrl)
    const ids = valid.map((row) => row.id)
    const [sizes, productRows] = ids.length ? await Promise.all([
      db.select().from(templateSizes).where(inArray(templateSizes.templateId, ids)).orderBy(asc(templateSizes.displayOrder)),
      db.select({ id: products.id, name: products.name, templateId: products.templateId, active: products.active }).from(products).where(inArray(products.templateId, ids)),
    ]) : [[], []]
    const productIds = productRows.filter((row) => row.active).map((row) => row.id)
    const prices = productIds.length ? await db.select().from(productTemplateSizePrices).where(inArray(productTemplateSizePrices.productId, productIds)) : []
    const sizesByTemplate = new Map<string, typeof sizes>()
    for (const size of sizes) { const list = sizesByTemplate.get(size.templateId) || []; list.push(size); sizesByTemplate.set(size.templateId, list) }
    const productsByTemplate = new Map<string, typeof productRows>()
    for (const product of productRows) { if (product.active) { const list = productsByTemplate.get(product.templateId || '') || []; list.push(product); productsByTemplate.set(product.templateId || '', list) } }
    const pricesByProduct = new Map<string, typeof prices>()
    for (const price of prices) { if (price.enabled) { const list = pricesByProduct.get(price.productId) || []; list.push(price); pricesByProduct.set(price.productId, list) } }
    return NextResponse.json({ data: { templates: valid.map((row) => ({
      id: row.id, name: row.name, description: row.description, category: row.category, previewUrl: row.previewImageUrl,
      version: row.templateVersion, logicalCanvasWidth: row.logicalCanvasWidth, logicalCanvasHeight: row.logicalCanvasHeight,
      updatedAt: row.updatedAt, sizes: (sizesByTemplate.get(row.id) || []).filter((size) => size.enabled),
      products: (productsByTemplate.get(row.id) || []).map((product) => ({ ...product, prices: pricesByProduct.get(product.id) || [] })),
    })) } }, { headers: { 'cache-control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Public template listing failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATES_LOAD_FAILED', message: 'Design Online templates could not be loaded.' } }, { status: 500 })
  }
}
