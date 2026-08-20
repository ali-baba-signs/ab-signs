import { asc, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { productCategories, products } from '@/lib/db/schema'

/** Public catalogue navigation is derived from admin-managed categories/products. */
export async function GET() {
  try {
    const categories = await db.select({ id: productCategories.id, name: productCategories.name, slug: productCategories.slug, displayOrder: productCategories.displayOrder }).from(productCategories).where(eq(productCategories.enabled, true)).orderBy(asc(productCategories.displayOrder), asc(productCategories.name))
    const categoryIds = categories.map((category) => category.id)
    const rows = categoryIds.length ? await db.select({ id: products.id, name: products.name, categoryId: products.categoryId }).from(products).where(eq(products.active, true)).orderBy(asc(products.name)) : []
    return NextResponse.json({ data: { navigation: categories.map((category) => ({ id: category.id, name: category.name, href: `/products?category=${encodeURIComponent(category.slug)}`, children: rows.filter((product) => product.categoryId === category.id).map((product) => ({ id: product.id, name: product.name, href: `/products/${product.id}` })) })).filter((category) => category.children.length > 0) } }, { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (error) {
    console.error('Navigation load failed', error)
    return NextResponse.json({ error: { code: 'NAVIGATION_LOAD_FAILED', message: 'Navigation is temporarily unavailable.' } }, { status: 500 })
  }
}
