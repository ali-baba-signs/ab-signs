import { NextRequest, NextResponse } from 'next/server'
import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { productCategories, products, productSizes, templateProducts, templates } from '@/lib/db/schema'
import { compatibleSizesForTemplate } from '@/lib/templates/compatibility'

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId')
    const links = await db.select().from(templateProducts).where(productId ? eq(templateProducts.productId, productId) : undefined)
    const templateIds = [...new Set(links.map((link) => link.templateId))]
    const productIds = [...new Set(links.map((link) => link.productId))]
    if (!templateIds.length || !productIds.length) return NextResponse.json({ data: { templates: [] } })
    const [rows, productRows, sizes, categories] = await Promise.all([
      db.select({ id: templates.id, name: templates.name, description: templates.description, previewImageUrl: templates.previewImageUrl, templateVersion: templates.templateVersion, templateSide: templates.templateSide, logicalCanvasWidth: templates.logicalCanvasWidth, logicalCanvasHeight: templates.logicalCanvasHeight, conversionStatus: templates.conversionStatus, status: templates.status, updatedAt: templates.updatedAt }).from(templates).where(inArray(templates.id, templateIds)).orderBy(asc(templates.name)),
      db.select({ id: products.id, name: products.name, categoryId: products.categoryId, active: products.active }).from(products).where(inArray(products.id, productIds)),
      db.select().from(productSizes).where(inArray(productSizes.productId, productIds)).orderBy(asc(productSizes.order)),
      db.select({ id: productCategories.id, name: productCategories.name }).from(productCategories),
    ])
    const valid = rows.filter((row) => row.templateSide !== 'back' && row.status === 'active' && row.conversionStatus === 'ready' && row.previewImageUrl)
    return NextResponse.json({ data: { templates: valid.map((row) => {
      const assignedProducts = productRows.filter((product) => product.active && links.some((link) => link.templateId === row.id && link.productId === product.id))
      const selectedProduct = productId ? assignedProducts.find((product) => product.id === productId) : assignedProducts[0]
      const inheritedSizes = selectedProduct
        ? compatibleSizesForTemplate(row.id, sizes.filter((size) => size.productId === selectedProduct.id))
        : []
      const category = categories.find((item) => item.id === selectedProduct?.categoryId)
      return { id: row.id, name: row.name, description: row.description, templateSide: row.templateSide, category: category?.name || 'Products', categoryId: selectedProduct?.categoryId, subcategory: selectedProduct?.name, previewUrl: row.previewImageUrl, version: row.templateVersion, logicalCanvasWidth: row.logicalCanvasWidth, logicalCanvasHeight: row.logicalCanvasHeight, updatedAt: row.updatedAt, sizes: inheritedSizes, products: assignedProducts.map((product) => ({ ...product, sizes: compatibleSizesForTemplate(row.id, sizes.filter((size) => size.productId === product.id)) })) }
    }).filter((row) => row.products.length > 0) } }, { headers: { 'cache-control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('Public template listing failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATES_LOAD_FAILED', message: 'Design Online templates could not be loaded.' } }, { status: 500 })
  }
}
