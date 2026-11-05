import { asc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { products } from '@/lib/db/schema'
import { indexableProduct, productUrl, SITEMAP_PAGE_SIZE, xmlResponse } from '@/lib/products/seo'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params
  if (!/^(0|[1-9]\d*)$/.test(page) || Number(page) > 1000000) return new Response('Not found', { status: 404 })
  const rows = await db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products)
    .where(indexableProduct).orderBy(asc(products.id)).limit(SITEMAP_PAGE_SIZE).offset(Number(page) * SITEMAP_PAGE_SIZE)
  if (!rows.length && page !== '0') return new Response('Not found', { status: 404 })
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map((row) => `<url><loc>${productUrl(row.slug)}</loc><lastmod>${row.updatedAt.toISOString()}</lastmod></url>`).join('')}</urlset>`)
}
