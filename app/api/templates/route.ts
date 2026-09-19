import { NextRequest, NextResponse } from 'next/server'
import { getProductsWithDetails } from '@/lib/products/queries'
import { isTemplateCompatibleWithSize } from '@/lib/templates/compatibility'
import type { DesignType } from '@/lib/products/design-configurations'

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId')
    const sizeId = request.nextUrl.searchParams.get('sizeId')
    const designType = request.nextUrl.searchParams.get('designType')
    if (designType && designType !== 'single_side' && designType !== 'double_side') return NextResponse.json({ error: { message: 'Invalid design option.' } }, { status: 400 })
    const products = (await getProductsWithDetails(productId || undefined)).filter((product) => product.active)
    const byId = new Map<string, Record<string, unknown> & { products: unknown[] }>()
    for (const product of products) {
      for (const template of product.templates) {
        if (template.status !== 'active' || template.conversionStatus !== 'ready' || !template.previewImageUrl) continue
        const sizes = product.sizes.filter((size) => (!sizeId || size.id === sizeId) && isTemplateCompatibleWithSize(template.id, size, designType as DesignType | undefined))
        if (!sizes.length) continue
        const assignedProduct = { id: product.id, name: product.name, categoryId: product.categoryId, sizes }
        const existing = byId.get(template.id)
        if (existing) existing.products.push(assignedProduct)
        else byId.set(template.id, { logicalCanvasWidth: template.logicalCanvasWidth, logicalCanvasHeight: template.logicalCanvasHeight, id: template.id, name: template.name, templateSide: template.templateSide, category: product.category?.name || 'Products', previewUrl: template.previewImageUrl, sizes, products: [assignedProduct] })
      }
    }
    return NextResponse.json({ data: { templates: [...byId.values()] } }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('Public template listing failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATES_LOAD_FAILED', message: 'Design Online templates could not be loaded.' } }, { status: 500 })
  }
}

