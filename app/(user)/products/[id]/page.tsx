// app/products/[id]/page.tsx  (SERVER component — no 'use client')
import type { Metadata } from 'next'
import { cache } from 'react'
import { headers } from 'next/headers'
import { temporaryCustomQuoteProduct } from '@/lib/products/temporary-custom-quotes'
import { ProductDetailClient } from './product-detail-client'

export const dynamic = 'force-dynamic'

const SITE_URL = 'https://alibabasigns.com.au'
const SITE_NAME = 'Alibaba Signs'
const FALLBACK_IMAGE = `${SITE_URL}/banner.jpg`
// ⚠️ Adjust to your real category listing URL
const categoryUrl = (slug: string) => `${SITE_URL}/products?category=${encodeURIComponent(slug)}`

type PageProps = { params: Promise<{ id: string }> }

/** Shape of the product returned by /api/products/[id] (fields used for SEO only) */
type ProductRecord = {
  id: string
  sku: string | null
  name: string
  description: string | null
  basePrice: string
  active: boolean
  allowCustomDimensions: boolean
  updatedAt: string
  images: Array<{ url: string; alt: string | null; isPrimary: boolean; order: number }>
  sizes: Array<{ label: string; unitPrice: string; enabled: boolean }>
  category: { name: string; slug: string } | null
  socialProof?: { averageRating: number; reviewCount: number; soldQuantity: number }
}

type SeoProduct = {
  id: string
  sku: string
  name: string
  summary: string // first real paragraph, plain text
  lowPrice: number | null
  highPrice: number | null
  sizeCount: number
  allowCustomDimensions: boolean
  category: { name: string; slug: string } | null
  images: Array<{ url: string; alt: string }>
  rating: { value: number; count: number } | null
  indexable: boolean
  isQuoteOnly: boolean
}

/* ---------------- helpers ---------------- */

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

function stripTags(html: string) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * The CMS description starts with headings like "Product Details" / "Description"
 * and can end with pasted price text, so take the first paragraph that reads like
 * real copy instead of flattening the whole HTML.
 */
function extractSummary(html: string) {
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]))
  const firstReal = paragraphs.find((p) => p.length >= 80)
  if (firstReal) return firstReal
  return stripTags(html).replace(/^(Product Details|Description)\s*/gi, '')
}

function truncate(text: string, max = 160) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'
}

function absoluteUrl(url: string) {
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

const money = (value: number) => value.toFixed(2)

/** Base URL of this app for server-side calls to its own API routes */
async function getBaseUrl() {
  if (process.env.INTERNAL_APP_URL) return process.env.INTERNAL_APP_URL.replace(/\/$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Loads one product through the existing /api/products/[id] route */
async function fetchProduct(id: string): Promise<ProductRecord | null> {
  const response = await fetch(`${await getBaseUrl()}/api/products/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Product API responded ${response.status}`)
  const payload = await response.json()
  // Your client reads payload.data.product; also accept a bare { product }
  return (payload?.data?.product ?? payload?.product ?? null) as ProductRecord | null
}

/* ---------------- data ---------------- */

// cache() → one DB call shared by generateMetadata and the page render
const loadSeoProduct = cache(async (id: string): Promise<SeoProduct | null> => {
  const temporary = temporaryCustomQuoteProduct(id)
  if (temporary) {
    return {
      id,
      sku: id,
      name: temporary.name,
      summary: temporary.description,
      lowPrice: null,
      highPrice: null,
      sizeCount: 0,
      allowCustomDimensions: true,
      category: null,
      images: [{ url: absoluteUrl(temporary.image), alt: temporary.name }],
      rating: null,
      indexable: true,
      isQuoteOnly: true,
    }
  }

  try {
    const product = await fetchProduct(id)
    if (!product) return null

    const prices = product.sizes
      .filter((size) => size.enabled)
      .map((size) => Number(size.unitPrice))
      .filter((price) => Number.isFinite(price) && price > 0)
    const base = Number(product.basePrice)
    if (!prices.length && base > 0) prices.push(base)

    const images = [...product.images]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.order - b.order)
      .map((img) => ({ url: absoluteUrl(img.url), alt: img.alt || product.name }))

    const reviews = product.socialProof
    return {
      id: product.id,
      sku: product.sku || product.id,
      name: product.name,
      summary: extractSummary(product.description || ''),
      lowPrice: prices.length ? Math.min(...prices) : null,
      highPrice: prices.length ? Math.max(...prices) : null,
      sizeCount: prices.length,
      allowCustomDimensions: product.allowCustomDimensions,
      category: product.category ? { name: product.category.name, slug: product.category.slug } : null,
      images,
      rating:
        reviews && reviews.reviewCount > 0 && reviews.averageRating > 0
          ? { value: reviews.averageRating, count: reviews.reviewCount }
          : null,
      indexable: product.active,
      isQuoteOnly: false,
    }
  } catch (error) {
    console.error(`SEO data for product "${id}" could not be loaded.`, error)
    return null
  }
})

/* ---------------- metadata ---------------- */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const product = await loadSeoProduct(id)

  if (!product) {
    return { title: `Product Not Found | ${SITE_NAME}`, robots: { index: false, follow: false } }
  }

  const url = `${SITE_URL}/products/${encodeURIComponent(id)}`

  // e.g. "Fabric Banner Printing Perth | From $27 | Alibaba Signs"
  const title = product.lowPrice
    ? `${product.name} Printing Perth | From $${product.lowPrice.toFixed(0)} | ${SITE_NAME}`
    : `${product.name} Printing Perth | Custom Quote | ${SITE_NAME}`

  // e.g. "Custom Fabric Banner from $27.00 in 20 sizes + custom sizes. Make a lasting impression…"
  const lead = product.lowPrice
    ? `Custom ${product.name} from $${money(product.lowPrice)}${
        product.sizeCount > 1 ? ` in ${product.sizeCount} sizes` : ''
      }${product.allowCustomDimensions ? ' + custom sizes' : ''}.`
    : `Request a custom quote for ${product.name}.`
  const description = truncate(`${lead} ${product.summary}`)

  const images = product.images.length
    ? product.images.slice(0, 4).map((img) => ({ url: img.url, width: 1000, height: 1000, alt: img.alt }))
    : [{ url: FALLBACK_IMAGE, alt: SITE_NAME }]

  const categoryName = product.category?.name
  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      product.name,
      `${product.name} Perth`,
      `${product.name} printing`,
      `custom ${product.name}`,
      ...(categoryName
        ? [`${categoryName} printing Perth`, `custom ${categoryName} Perth`, `${categoryName} Australia`]
        : []),
      'sign printing Perth',
      'custom signs Perth',
    ],
    category: categoryName,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_AU',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((img) => img.url),
    },
    // Facebook / Pinterest product tags (Next has no openGraph type "product")
    other: product.lowPrice
      ? {
          'product:price:amount': money(product.lowPrice),
          'product:price:currency': 'AUD',
          'product:availability': 'in stock',
          'product:brand': SITE_NAME,
          'product:retailer_item_id': product.sku,
        }
      : {},
    robots: product.indexable
      ? { index: true, follow: true, googleBot: { 'max-image-preview': 'large' } }
      : { index: false, follow: true },
  }
}

/* ---------------- page ---------------- */

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params
  const product = await loadSeoProduct(id)
  const url = `${SITE_URL}/products/${encodeURIComponent(id)}`

  const offers =
    product?.lowPrice && product.highPrice && !product.isQuoteOnly
      ? product.lowPrice === product.highPrice
        ? {
            '@type': 'Offer',
            url,
            priceCurrency: 'AUD',
            price: money(product.lowPrice),
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@id': `${SITE_URL}/#organization` },
          }
        : {
            '@type': 'AggregateOffer',
            url,
            priceCurrency: 'AUD',
            lowPrice: money(product.lowPrice),
            highPrice: money(product.highPrice),
            offerCount: product.sizeCount,
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@id': `${SITE_URL}/#organization` },
          }
      : null

  const breadcrumbs = product
    ? [
        { name: 'Home', item: `${SITE_URL}/` },
        { name: 'Products', item: `${SITE_URL}/products` },
        ...(product.category ? [{ name: product.category.name, item: categoryUrl(product.category.slug) }] : []),
        { name: product.name, item: url },
      ]
    : []

  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Product',
            '@id': `${url}#product`,
            name: product.name,
            description: truncate(product.summary, 500),
            image: product.images.map((img) => img.url),
            url,
            sku: product.sku,
            mpn: product.sku,
            ...(product.category ? { category: product.category.name } : {}),
            brand: { '@type': 'Brand', name: SITE_NAME },
            ...(offers ? { offers } : {}),
            // Only from real published reviews; omitted when there are none
            ...(product.rating
              ? {
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: product.rating.value.toFixed(1),
                    reviewCount: product.rating.count,
                    bestRating: '5',
                    worstRating: '1',
                  },
                }
              : {}),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.map((crumb, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: crumb.name,
              item: crumb.item,
            })),
          },
        ],
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      <ProductDetailClient params={params} />
    </>
  )
}
