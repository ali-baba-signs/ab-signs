import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { productCategories, products, productSizes, templates } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId')
    const rows = await db.select({ id: templates.id, productId: templates.productId, name: templates.name, description: templates.description, previewImageUrl: templates.previewImageUrl, templateVersion: templates.templateVersion, logicalCanvasWidth: templates.logicalCanvasWidth, logicalCanvasHeight: templates.logicalCanvasHeight, conversionStatus: templates.conversionStatus, updatedAt: templates.updatedAt }).from(templates)
      .where(productId ? and(eq(templates.status, 'active'), eq(templates.productId, productId)) : eq(templates.status, 'active')).orderBy(asc(templates.name))
    const valid = rows.filter((row) => row.productId && row.conversionStatus === 'ready' && row.previewImageUrl)
    const productIds = [...new Set(valid.map((row) => row.productId!))]
    const [productRows, sizes, categories] = productIds.length ? await Promise.all([
      db.select({ id: products.id, name: products.name, categoryId: products.categoryId, active: products.active }).from(products).where(inArray(products.id, productIds)),
      db.select().from(productSizes).where(inArray(productSizes.productId, productIds)).orderBy(asc(productSizes.order)),
      db.select({ id: productCategories.id, name: productCategories.name }).from(productCategories),
    ]) : [[], [], []]
    const activeProducts = productRows.filter((product) => product.active)
    return NextResponse.json({ data: { templates: valid.flatMap((row) => {
      const product = activeProducts.find((item) => item.id === row.productId)
      if (!product) return []
      const category = categories.find((item) => item.id === product.categoryId)
      const inheritedSizes = sizes.filter((size) => size.productId === product.id && size.enabled)
      return [{ id: row.id, name: row.name, description: row.description, category: category?.name || 'Products', categoryId: product.categoryId, subcategory: product.name, previewUrl: row.previewImageUrl, version: row.templateVersion, logicalCanvasWidth: row.logicalCanvasWidth, logicalCanvasHeight: row.logicalCanvasHeight, updatedAt: row.updatedAt, sizes: inheritedSizes, products: [{ ...product, sizes: inheritedSizes }] }]
    }) } }, { headers: { 'cache-control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Public template listing failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATES_LOAD_FAILED', message: 'Design Online templates could not be loaded.' } }, { status: 500 })
  }
}
