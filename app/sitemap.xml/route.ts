import { count } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { products } from '@/lib/db/schema'
import { indexableProduct, SITEMAP_PAGE_SIZE, SITE_URL, xmlResponse } from '@/lib/products/seo'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [{ total }] = await db.select({ total: count() }).from(products).where(indexableProduct)
  const pages = Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE))
  const urls = [`${SITE_URL}/sitemaps/static`, ...Array.from({ length: pages }, (_, index) => `${SITE_URL}/sitemaps/products/${index}`)]
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<sitemap><loc>${url}</loc></sitemap>`).join('')}</sitemapindex>`)
}