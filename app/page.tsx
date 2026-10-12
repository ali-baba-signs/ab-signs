import type { Metadata } from 'next'
import { CartProvider } from '@/lib/cart-context'
import { Header } from '@/components/shared/header'
import { Footer } from '@/components/shared/footer'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import {
  ArtworkOptions,
  BenefitsStrip,
  CategoryGrid,
  DesignOnlineSection,
  ProductHighlights,
  PromotionGrid,
  SeoContent,
} from '@/components/home/HomeSections'
import { heroSlides, resolveAsset } from '@/data/homepage'
import { getHeroSlides } from '@/lib/home/hero-data'
import { getHomepageCategories } from '@/lib/home/category-data'
import { getHomepagePromotions } from '@/lib/home/promotion-data'
import { getPopularProducts } from '@/lib/products/queries'
import { richTextToPlainText } from '@/lib/content/sanitize-html'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Alibaba Signs Australia | Custom Banners, Flags & Online Design',
  description: 'Create custom vinyl banners, mesh banners and feather flags with Alibaba Signs online design tools.',
  alternates: { canonical: 'https://alibabasigns.com.au/' },
  openGraph: {
    title: 'Alibaba Signs Australia',
    description: 'Custom signage and online artwork tools for Australian businesses and events.',
    url: 'https://alibabasigns.com.au/',
    type: 'website',
  },
  keywords: [
    'custom banners', 'vinyl banners', 'mesh banners', 'sign printing', 'design editor', 
    'Feather Flag', 'Teardrop Flag', 'signage company Perth', 'custom signs Perth', 
    'shop front signs Perth', 'banner printing Perth', 'flag printing Perth', 
    'A-frame signs Perth', 'real estate signs Perth', 'outdoor vinyl banners Perth', 
    'fence mesh banners Perth', 'safety signs Perth', 'coreflute signs Perth', 
    'outdoor signs Perth', 'business signage Perth', 'custom printed tablecloths Perth', 
    'promotional signage Perth', 'affordable signage Perth', 'Perth sign maker', 
    'Perth sign printing', 'Perth sign installation'
  ]
}

export default async function HomePage() {
  let homepageCategories: Awaited<ReturnType<typeof getHomepageCategories>> = []
  let homepagePromotions: Awaited<ReturnType<typeof getHomepagePromotions>> = []
  let popularProducts: Awaited<ReturnType<typeof getPopularProducts>> = []
  let slides = heroSlides
    .filter((slide) => slide.enabled && slide.featured)
    .sort((a, b) => a.priority - b.priority)
    .map((slide) => ({
      ...slide,
      image: resolveAsset(slide.desktopImageKey, slide.fallbackImage),
      mobileImage: resolveAsset(slide.mobileImageKey, slide.fallbackImage),
    }))

  try {
    const managedRows = await getHeroSlides()
    const managed = managedRows.filter((slide) => slide.enabled && slide.featured && slide.desktopAsset)
    if (managedRows.length) slides = managed.map((slide) => ({
      id: slide.id,
      eyebrow: slide.eyebrow || '',
      title: slide.title || '',
      description: slide.description || '',
      desktopImageKey: slide.desktopAsset!.objectKey,
      mobileImageKey: slide.mobileAsset?.objectKey || slide.desktopAsset!.objectKey,
      fallbackImage: slide.desktopAsset!.url,
      altText: slide.altText||'',
      href: slide.buttonUrl || '',
      buttonLabel: slide.buttonLabel || '',
      alignment: slide.horizontalAlignment as 'left' | 'center' | 'right',
      verticalAlignment: slide.verticalAlignment as 'top' | 'middle' | 'bottom',
      styleConfig: slide.styleConfig,
      enabled: slide.enabled,
      featured: slide.featured,
      priority: slide.displayOrder,
      image: slide.desktopAsset!.url,
      mobileImage: slide.mobileAsset?.url || slide.desktopAsset!.url,
    }))
  } catch (error) {
    console.error('Managed homepage heroes could not be loaded; using built-in fallbacks.', error)
  }
  try { homepageCategories = await getHomepageCategories() } catch (error) { console.error('Homepage categories could not be loaded.', error) }
  try { homepagePromotions = await getHomepagePromotions() } catch (error) { console.error('Homepage promotions could not be loaded.', error) }
  try { popularProducts = await getPopularProducts(3) } catch (error) { console.error('Popular products could not be loaded.', error) }

  const popularProductCards = popularProducts.flatMap((product) => {
    const image = product.images.find((item) => item.isPrimary) || product.images[0]
    return image ? [{ id: product.id, name: product.name, description: richTextToPlainText(product.description || ''), image: image.url, basePrice: product.basePrice, soldQuantity: product.socialProof.soldQuantity }] : []
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SignShop',
        '@id': 'https://alibabasigns.com.au/#organization',
        'name': 'Alibaba Signs',
        'url': 'https://alibabasigns.com.au/',
        'logo': 'https://alibabasigns.com.au/logo.png',
        'image': 'https://alibabasigns.com.au/banner.jpg',
        'description': 'Leading signage company in Perth offering custom shop front signs, outdoor vinyl banners, flag printing, A-frame signs, real estate signs, fence mesh banners, coreflute printing, and safety signs across Perth Metropolitan area.',
        'telephone': '0478 230 945', 
        'email': 'sales@alibabasigns.com.au',
        'priceRange': '$$',
        'knowsAbout': [
          'custom banners', 'vinyl banners', 'mesh banners', 'sign printing', 
          'design editor', 'Feather Flag', 'Teardrop Flag', 'signage company Perth', 
          'custom signs Perth', 'shop front signs Perth', 'banner printing Perth', 
          'flag printing Perth', 'A-frame signs Perth', 'real estate signs Perth', 
          'outdoor vinyl banners Perth', 'fence mesh banners Perth', 'safety signs Perth', 
          'coreflute signs Perth', 'outdoor signs Perth', 'business signage Perth', 
          'custom printed tablecloths Perth', 'promotional signage Perth', 
          'affordable signage Perth', 'Perth sign maker', 'Perth sign printing', 
          'Perth sign installation'
        ],
        'address': {
          '@type': 'PostalAddress',
          'streetAddress': 'Southern River',
          'addressLocality': 'Southern River',
          'addressRegion': 'WA',
          'addressCountry': 'AU'
        },
        'geo': {
          '@type': 'GeoCoordinates',
          'latitude': -32.0911,
          'longitude': 115.9525
        },
        'areaServed': [
          { '@type': 'AdministrativeArea', 'name': 'Perth Metropolitan Area' },
          { '@type': 'Place', 'name': 'Southern River' },
          { '@type': 'Place', 'name': 'Canning Vale' },
          { '@type': 'Place', 'name': 'Jandakot' },
          { '@type': 'Place', 'name': 'Forrestdale' },
          { '@type': 'Place', 'name': 'Maddington' },
          { '@type': 'Place', 'name': 'Cannington' },
          { '@type': 'Place', 'name': 'Gosnells' },
          { '@type': 'Place', 'name': 'Piara Waters' },
          { '@type': 'Place', 'name': 'Harrisdale' },
          { '@type': 'Place', 'name': 'Armadale' },
          { '@type': 'Place', 'name': 'Kelmscott' },
          { '@type': 'Place', 'name': 'Bibra Lake' }
        ]
      },
      {
        '@type': 'Product',
        '@id': 'https://alibabasigns.com.au/#product',
        'name': 'Custom Shop Front Signs & Business Signage Perth',
        'description': 'High-impact custom shop front sign design, outdoor vinyl banners, A-frame signs, and business branding installation in Perth.',
        'brand': { '@id': 'https://alibabasigns.com.au/#organization' },
        'offers': {
          '@type': 'AggregateOffer',
          'priceCurrency': 'USD',
          'lowPrice': '50',
          'highPrice': '1500',
          'offerCount': '10',
          'availability': 'https://schema.org/InStock'
        }
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://alibabasigns.com.au/#faq',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': 'Who makes affordable shop signs in Perth?',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': 'Alibaba Signs provides durable and affordable custom shop front signs, outdoor vinyl banners, lightboxes, coreflute signs, and full business branding solutions across the Perth Metropolitan Area, including Southern River, Canning Vale, and surrounding suburbs.'
            }
          }
        ]
      }
    ]
  }

  return (
    <CartProvider>
      <div className="min-h-screen overflow-x-clip bg-white text-[#111]">
        <Header />
         <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
        <main>
          {slides.length > 0 && <HeroCarousel slides={slides} />}
          <BenefitsStrip />
          <CategoryGrid categories={homepageCategories} />
          <ProductHighlights products={popularProductCards} />
          <PromotionGrid promotions={homepagePromotions} />
          <DesignOnlineSection />
          <ArtworkOptions />
          <SeoContent />
        </main>
        <Footer />
      </div>
    </CartProvider>
  )
}
