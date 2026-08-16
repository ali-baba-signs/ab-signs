import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { products, productSizes, productTemplateSizePrices, templateSizes, templates } from '@/lib/db/schema'
import { createTemplateCanvasSize, type MeasurementUnit } from '@/lib/templates/size-conversion'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const productId = request.nextUrl.searchParams.get('productId')
  const sizeId = request.nextUrl.searchParams.get('sizeId')
  const editorData = request.nextUrl.searchParams.get('editor') === '1'
  try {
    const [template] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
    if (!template || template.status !== 'active' || template.conversionStatus !== 'ready') return NextResponse.json({ error: { code: 'TEMPLATE_UNAVAILABLE', message: 'This editable template is not available.' } }, { status: 404 })
    if (!template.canvasData || !template.logicalCanvasWidth || !template.logicalCanvasHeight) return NextResponse.json({ error: { code: 'TEMPLATE_INVALID', message: 'The template is missing its canonical editor data.' } }, { status: 422 })
    let config = { widthMm: Number(template.physicalWidth), heightMm: Number(template.physicalHeight), logicalCanvasWidth: template.logicalCanvasWidth, logicalCanvasHeight: template.logicalCanvasHeight }
    let productSize: (typeof templateSizes.$inferSelect | typeof productSizes.$inferSelect) | null = null
    const availableSizes = await db.select().from(templateSizes).where(eq(templateSizes.templateId, template.id))
    if (productId) {
      const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
      const [variantMapping] = product?.active && sizeId && product.sizeMode === 'fixed_variants' ? await db.select().from(productSizes).where(and(eq(productSizes.id, sizeId), eq(productSizes.productId, product.id))).limit(1) : []
      const assignedToVariant = variantMapping?.frontTemplateId === template.id || variantMapping?.backTemplateId === template.id
      if (!product?.active || (product.templateId !== template.id && !assignedToVariant)) return NextResponse.json({ error: { code: 'TEMPLATE_PRODUCT_MISMATCH', message: 'This template is not assigned to the selected product variant.' } }, { status: 409 })
      if (sizeId && product.sizeMode === 'template_sizes') {
        const size = availableSizes.find((row) => row.id === sizeId && row.enabled)
        if (!size) return NextResponse.json({ error: { code: 'SIZE_UNAVAILABLE', message: 'The selected template size is not available for editing.' } }, { status: 409 })
        const [price] = await db.select().from(productTemplateSizePrices).where(and(eq(productTemplateSizePrices.templateSizeId, size.id), eq(productTemplateSizePrices.productId, product.id))).limit(1)
        if (!price?.enabled) return NextResponse.json({ error: { code: 'SIZE_UNAVAILABLE', message: 'This size is not enabled for the selected product.' } }, { status: 409 })
        const productCanvas = createTemplateCanvasSize(Number(size.width), Number(size.height), size.unit as MeasurementUnit)
        config = productCanvas
        productSize = size
      } else if (sizeId) {
        const [size] = await db.select().from(productSizes).where(and(eq(productSizes.id, sizeId), eq(productSizes.productId, product.id))).limit(1)
        if (!size?.enabled || !size.width || !size.height) return NextResponse.json({ error: { code: 'VARIANT_UNAVAILABLE', message: 'The selected fixed production variant is unavailable or has no configured print dimensions.' } }, { status: 409 })
        config = createTemplateCanvasSize(Number(size.width), Number(size.height), size.unit as MeasurementUnit)
        productSize = size
      }
    } else if (sizeId) {
      const size = availableSizes.find((row) => row.id === sizeId && row.enabled)
      if (!size) return NextResponse.json({ error: { code: 'SIZE_UNAVAILABLE', message: 'The selected template size is unavailable.' } }, { status: 409 })
      config = createTemplateCanvasSize(Number(size.width), Number(size.height), size.unit as MeasurementUnit)
      productSize = size
    }
    const fitMode = productSize && 'fitMode' in productSize ? productSize.fitMode : 'contain'
    const safeMargin = productSize && 'safeMargin' in productSize ? Number(productSize.safeMargin) : Math.min(config.widthMm, config.heightMm) * 0.03
    const bleed = productSize && 'bleed' in productSize ? Number(productSize.bleed) : 3
    const sideMode = productSize && 'sideMode' in productSize ? productSize.sideMode : 'single'
    return NextResponse.json({ data: { template: { id: template.id, name: template.name, version: template.templateVersion, ...(editorData ? { canvasData: template.canvasData, baseCanvasWidth: template.logicalCanvasWidth, baseCanvasHeight: template.logicalCanvasHeight } : { previewUrl: template.previewImageUrl, description: template.description, category: template.category }) }, productId, productSize, availableSizes, fitMode, productConfig: { widthMm: config.widthMm, heightMm: config.heightMm, bleedMm: bleed, safeMarginMm: safeMargin, logicalCanvasWidth: config.logicalCanvasWidth, logicalCanvasHeight: config.logicalCanvasHeight, measurementUnit: productSize?.unit || template.measurementUnit || 'mm', sideMode } } }, { headers: { 'cache-control': 'private, max-age=60, stale-while-revalidate=300' } })
  } catch (error) {
    console.error('Editable template load failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATE_LOAD_FAILED', message: 'The editable template could not be loaded.' } }, { status: 500 })
  }
}
