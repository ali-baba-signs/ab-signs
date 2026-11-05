import { SITE_URL, xmlResponse } from '@/lib/products/seo'
import { TEMPORARY_CUSTOM_QUOTE_PRODUCTS } from '@/lib/products/temporary-custom-quotes'

const paths = ['', '/products', '/design', '/about-us', '/contact', '/blog', '/faq', '/policies', '/terms-of-service', '/privacy-policy', '/refund-returns-policy', '/shipping-policy', '/warranty-disclaimer', '/cookie-policy', '/sitemap', ...TEMPORARY_CUSTOM_QUOTE_PRODUCTS.map((product) => `/products/${encodeURIComponent(product.id)}`)]

export function GET() {
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${SITE_URL}${path}</loc></url>`).join('')}</urlset>`)
}
