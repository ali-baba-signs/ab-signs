import { NextRequest, NextResponse } from 'next/server'
import { getProductsWithDetails } from '@/lib/products/queries'

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category')
    const featured = request.nextUrl.searchParams.get('featured')
    const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase()
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 50, 1), 100)
    const rows = (await getProductsWithDetails()).filter((product) => {
      if (category && category !== 'all' && product.category?.slug !== category && product.category?.category !== category) return false
      if (featured === 'true' && !product.featured) return false
      if (search && !`${product.name} ${product.sku}`.toLowerCase().includes(search)) return false
      return true
    }).slice(0, limit)
    return NextResponse.json({ data: { products: rows, total: rows.length } })
  } catch (error) {
    console.error('Public products load failed', error)
    return NextResponse.json({ error: { code: 'PRODUCTS_LOAD_FAILED', message: 'Products are temporarily unavailable.' } }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json({ error: { code: 'ADMIN_ENDPOINT_REQUIRED', message: 'Product changes require the protected admin API.' } }, { status: 403 })
}
