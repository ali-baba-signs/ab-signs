import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { productCategories, products, productSizes, templates } from '@/lib/db/schema'
import { createTemplateCanvasSize, type MeasurementUnit } from '@/lib/templates/size-conversion'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const requestedProductId = request.nextUrl.searchParams.get('productId')
  const sizeId = request.nextUrl.searchParams.get('sizeId')
  const editorData = request.nextUrl.searchParams.get('editor') === '1'
  try {
    const [template] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
    if (!template || template.status !== 'active' || template.conversionStatus !== 'ready') return NextResponse.json({ error: { code: 'TEMPLATE_UNAVAILABLE', message: 'This editable template is not available.' } }, { status: 404 })
    if (!template.canvasData || !template.logicalCanvasWidth || !template.logicalCanvasHeight || !template.productId) return NextResponse.json({ error: { code: 'TEMPLATE_INVALID', message: 'The template is missing its product or canonical editor data.' } }, { status: 422 })
    const productId = requestedProductId || template.productId
    if (productId !== template.productId) return NextResponse.json({ error: { code: 'TEMPLATE_PRODUCT_MISMATCH', message: 'This template is not compatible with the selected product.' } }, { status: 409 })
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product?.active) return NextResponse.json({ error: { code: 'PRODUCT_UNAVAILABLE', message: 'The selected product is unavailable.' } }, { status: 409 })
    const availableSizes = (await db.select().from(productSizes).where(eq(productSizes.productId, product.id)).orderBy(asc(productSizes.order))).filter((size) => size.enabled)
    const productSize = sizeId ? availableSizes.find((size) => size.id === sizeId) : availableSizes.find((size) => size.isDefault) || availableSizes[0]
    if (!productSize?.width || !productSize.height) return NextResponse.json({ error: { code: 'SIZE_UNAVAILABLE', message: 'The selected product size is unavailable for editing.' } }, { status: 409 })
    const config = createTemplateCanvasSize(Number(productSize.width), Number(productSize.height), productSize.unit as MeasurementUnit)
    const [category] = await db.select({ name: productCategories.name }).from(productCategories).where(eq(productCategories.id, product.categoryId)).limit(1)
    return NextResponse.json({ data: {
      template: { id: template.id, name: template.name, version: template.templateVersion, ...(editorData ? { canvasData: template.canvasData, baseCanvasWidth: template.logicalCanvasWidth, baseCanvasHeight: template.logicalCanvasHeight } : { previewUrl: template.previewImageUrl, description: template.description, category: category?.name || 'Products', subcategory: product.name }) },
      productId, productSize, availableSizes, fitMode: productSize.fitMode,
      productConfig: { widthMm: config.widthMm, heightMm: config.heightMm, bleedMm: Number(productSize.bleed), safeMarginMm: Number(productSize.safeMargin), logicalCanvasWidth: config.logicalCanvasWidth, logicalCanvasHeight: config.logicalCanvasHeight, measurementUnit: productSize.unit, sideMode: productSize.sideMode, trimMarks: productSize.trimMarks },
    } }, { headers: { 'cache-control': editorData ? 'private, max-age=60, stale-while-revalidate=300' : 'no-store' } })
  } catch (error) {
    console.error('Editable template load failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATE_LOAD_FAILED', message: 'The editable template could not be loaded.' } }, { status: 500 })
  }
}
