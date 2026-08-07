import { NextRequest, NextResponse } from 'next/server'
import { getProductsWithDetails } from '@/lib/products/queries'
import { sanitizeRichText } from '@/lib/content/sanitize-html'

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const [product] = await getProductsWithDetails(id)
    if (!product || !product.active) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Product not found.' } }, { status: 404 })
    return NextResponse.json({ data: { product: { ...product, description: sanitizeRichText(product.description), sizes: product.sizes.filter((size) => size.enabled), template: product.template?.status === 'active' ? product.template : null } } })
  } catch (error) {
    console.error('Product detail load failed', error)
    return NextResponse.json({ error: { code: 'PRODUCT_LOAD_FAILED', message: 'The product could not be loaded.' } }, { status: 500 })
  }
}
