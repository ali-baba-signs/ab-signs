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

  return (
    <CartProvider>
      <div className="min-h-screen overflow-x-clip bg-white text-[#111]">
        <Header />
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
