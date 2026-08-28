import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { productCategories, products, productSizes, templateProducts, templates } from '@/lib/db/schema'
import { createTemplateCanvasSize, type MeasurementUnit } from '@/lib/templates/size-conversion'
import { compatibleSizesForTemplate } from '@/lib/templates/compatibility'
import { designConfigurationForSize, enabledDesignConfigurations, type DesignType } from '@/lib/products/design-configurations'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const requestedProductId = request.nextUrl.searchParams.get('productId')
  const sizeId = request.nextUrl.searchParams.get('sizeId')
  const requestedDesignType = request.nextUrl.searchParams.get('designType') as DesignType | null
  const editorData = request.nextUrl.searchParams.get('editor') === '1'
  try {
    const [template] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
    if (!template || template.status !== 'active' || template.conversionStatus !== 'ready') return NextResponse.json({ error: { code: 'TEMPLATE_UNAVAILABLE', message: 'This editable template is not available.' } }, { status: 404 })
    if (template.templateSide === 'back') return NextResponse.json({ error: { code: 'BACK_TEMPLATE_PRIVATE', message: 'Back templates are loaded only as part of their configured double-sided product.' } }, { status: 404 })
    if (!template.canvasData || !template.logicalCanvasWidth || !template.logicalCanvasHeight) return NextResponse.json({ error: { code: 'TEMPLATE_INVALID', message: 'The template is missing its canonical editor data.' } }, { status: 422 })
    const links = await db.select().from(templateProducts).where(eq(templateProducts.templateId, template.id))
    const productId = requestedProductId || links[0]?.productId
    if (!productId) return NextResponse.json({ error: { code: 'TEMPLATE_PRODUCT_MISMATCH', message: 'This template is not connected to a product size.' } }, { status: 409 })
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product?.active) return NextResponse.json({ error: { code: 'PRODUCT_UNAVAILABLE', message: 'The selected product is unavailable.' } }, { status: 409 })
    const availableSizes = compatibleSizesForTemplate(
      template.id,
      await db.select().from(productSizes).where(eq(productSizes.productId, product.id)).orderBy(asc(productSizes.order)),
    )
    const productSize = sizeId ? availableSizes.find((size) => size.id === sizeId) : availableSizes.find((size) => size.isDefault) || availableSizes[0]
    if (!productSize?.width || !productSize.height) return NextResponse.json({ error: { code: 'SIZE_UNAVAILABLE', message: sizeId ? 'This template is not available for the selected size. Please choose another size.' : 'No enabled product size is compatible with this template.' } }, { status: 409 })
    const inferredDesignType = enabledDesignConfigurations(productSize).find((configuration) => configuration.designType === 'single_side' ? configuration.singleTemplateId === template.id : configuration.frontTemplateId === template.id)?.designType
    const designType = requestedDesignType === 'single_side' || requestedDesignType === 'double_side' ? requestedDesignType : inferredDesignType
    const designConfiguration = designType ? designConfigurationForSize(productSize, designType) : null
    if (!designConfiguration) return NextResponse.json({ error: { code: 'DESIGN_OPTION_UNAVAILABLE', message: 'This design option is not available for the selected size.' } }, { status: 409 })
    if (designType === 'double_side') {
      if (template.templateSide !== 'front' || designConfiguration.frontTemplateId !== template.id) return NextResponse.json({ error: { code: 'FRONT_TEMPLATE_REQUIRED', message: 'Choose the configured front template for this size and double-sided option.' } }, { status: 409 })
      if (!designConfiguration.backTemplateId) return NextResponse.json({ error: { code: 'BACK_TEMPLATE_REQUIRED', message: 'This size is missing its double-sided back template configuration.' } }, { status: 409 })
    } else if (template.templateSide !== 'single' || (designConfiguration.singleTemplateId || product.templateId) !== template.id) {
      return NextResponse.json({ error: { code: 'SINGLE_TEMPLATE_REQUIRED', message: 'Choose a single-side template for this product option.' } }, { status: 409 })
    }
    const [backTemplate] = designType === 'double_side' && designConfiguration.backTemplateId
      ? await db.select().from(templates).where(eq(templates.id, designConfiguration.backTemplateId)).limit(1)
      : []
    if (designType === 'double_side' && (!backTemplate || backTemplate.templateSide !== 'back' || backTemplate.status !== 'active' || backTemplate.conversionStatus !== 'ready' || !backTemplate.canvasData)) {
      return NextResponse.json({ error: { code: 'BACK_TEMPLATE_UNAVAILABLE', message: 'The configured back template is not ready for editing.' } }, { status: 409 })
    }
    const config = createTemplateCanvasSize(Number(productSize.width), Number(productSize.height), productSize.unit as MeasurementUnit)
    const [category] = await db.select({ name: productCategories.name }).from(productCategories).where(eq(productCategories.id, product.categoryId)).limit(1)
    return NextResponse.json({ data: {
      template: { id: template.id, name: template.name, version: template.templateVersion, templateKind: template.templateKind, templateSide: template.templateSide, printableArea: template.printableArea, maskReference: template.fixedSvgKey, ...(editorData ? { canvasData: template.canvasData, fixedCanvasData: template.fixedCanvasData, baseCanvasWidth: template.logicalCanvasWidth, baseCanvasHeight: template.logicalCanvasHeight } : { previewUrl: template.previewImageUrl, description: template.description, category: category?.name || 'Products', subcategory: product.name }) },
      backTemplate: backTemplate ? { id: backTemplate.id, name: backTemplate.name, version: backTemplate.templateVersion, templateKind: backTemplate.templateKind, templateSide: backTemplate.templateSide, printableArea: backTemplate.printableArea, maskReference: backTemplate.fixedSvgKey, ...(editorData ? { canvasData: backTemplate.canvasData, fixedCanvasData: backTemplate.fixedCanvasData, baseCanvasWidth: backTemplate.logicalCanvasWidth, baseCanvasHeight: backTemplate.logicalCanvasHeight } : { previewUrl: backTemplate.previewImageUrl }) } : null,
      productId, designType, designMode: designType, productSize, availableSizes, fitMode: productSize.fitMode,
      productConfig: { widthMm: config.widthMm, heightMm: config.heightMm, bleedMm: Number(productSize.bleed), safeMarginMm: Number(productSize.safeMargin), logicalCanvasWidth: config.logicalCanvasWidth, logicalCanvasHeight: config.logicalCanvasHeight, measurementUnit: productSize.unit, sideMode: designType === 'double_side' ? 'double' : 'single', designType, productId, productCategory: template.templateKind, selectedSizeId: productSize.id, templateReference: template.id, trimMarks: productSize.trimMarks, productionGuideVersion: 3 },
    } }, { headers: { 'cache-control': editorData ? 'private, max-age=60, stale-while-revalidate=300' : 'no-store' } })
  } catch (error) {
    console.error('Editable template load failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATE_LOAD_FAILED', message: 'The editable template could not be loaded.' } }, { status: 500 })
  }
}
