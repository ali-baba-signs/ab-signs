import { and, eq, ne, sql } from 'drizzle-orm'
import { products } from '@/lib/db/schema'

export const SITE_URL = 'https://alibabasigns.com.au'
export const SITEMAP_PAGE_SIZE = 10000

// Keep this aligned with public catalog visibility and page routing.
export const indexableProduct = and(
  eq(products.active, true),
  eq(products.seoNoindex, false),
  sql`left(${products.sku}, 7) <> 'SYSTEM_'`,
  ne(products.sku, 'CUSTOM-ARTWORK-ITEM'),
  ne(products.name, 'Custom Product'),
)

export const productUrl = (slug: string) => `${SITE_URL}/products/${encodeURIComponent(slug)}`
export const xmlResponse = (xml: string) => new Response(xml, {
  headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-store' },
})
