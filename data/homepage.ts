import { getPublicAssetUrl } from '@/lib/storage/r2-public-url'
import type { HeroStyleConfig } from '@/lib/home/hero-style'

export interface HeroSlide {
  id: string
  eyebrow: string
  title: string
  description: string
  desktopImageKey: string
  mobileImageKey: string
  fallbackImage: string
  altText: string
  href: string
  buttonLabel: string
  alignment: 'left' | 'center' | 'right'
  verticalAlignment: 'top' | 'middle' | 'bottom'
  styleConfig?: HeroStyleConfig
  featured: boolean
  enabled: boolean
  priority: number
}

export interface HomepageCategory {
  id: string
  name: string
  description: string
  href: string
  imageKey: string
  fallbackImage: string
}

export const promoMessages = [
  'Australia-wide delivery',
  'Professional print production',
  'Custom sizes available',
  'Design online',
]

export const productNavigation = [
  {
    id: 'banners',
    name: 'Banners',
    href: '/products?category=vinyl-banner',
    children: [
      { name: 'Vinyl Banners', href: '/products?category=vinyl-banner' },
      { name: 'Mesh Banners', href: '/products?category=mesh-banner' },
      { name: 'All Banners', href: '/products' },
    ],
  },
  {
    id: 'mesh',
    name: 'Mesh Banners',
    href: '/products?category=mesh-banner',
    children: [{ name: 'Browse Mesh Banners', href: '/products?category=mesh-banner' }],
  },
  {
    id: 'flags',
    name: 'Flags',
    href: '/products?category=flags',
    children: [{ name: 'Feather Flags', href: '/products?category=flags' }],
  },
]

export const heroSlides: HeroSlide[] = [
  {
    id: 'print-production',
    eyebrow: 'Custom printing for Australian businesses',
    title: 'Make your message impossible to miss.',
    description: 'Create banners, flags and display graphics with an online editor built for real print production.',
    desktopImageKey: 'homepage/hero/desktop/print-production.png',
    mobileImageKey: 'homepage/hero/mobile/print-production.png',
    fallbackImage: '/hero.png',
    altText: 'Custom printed business signage and banners',
    href: '/products',
    buttonLabel: 'Shop signage',
    alignment: 'left',
    verticalAlignment: 'middle',
    featured: true,
    enabled: true,
    priority: 1,
  },
  {
    id: 'design-online',
    eyebrow: 'Your artwork, your way',
    title: 'Start with a template. Finish with your brand.',
    description: 'Add your logo, text and graphics in the Alibaba Signs online design studio.',
    desktopImageKey: 'homepage/hero/desktop/design-online.png',
    mobileImageKey: 'homepage/hero/mobile/design-online.png',
    fallbackImage: '/banner1.png',
    altText: 'Editable online signage design template',
    href: '/design',
    buttonLabel: 'Start designing',
    alignment: 'right',
    verticalAlignment: 'middle',
    featured: true,
    enabled: true,
    priority: 2,
  },
]

export const benefits = [
  { title: 'Print-Ready Quality', description: 'Professional production standards for signage, banners, flags and custom print.' },
  { title: 'Flexible Sizing', description: 'Choose standard sizes or supported custom dimensions where the product allows.' },
  { title: 'Design Online', description: 'Customise supported templates in a purpose-built browser print editor.' },
  { title: 'Australia-Wide Service', description: 'Order online with production and delivery support across Australia.' },
]

export function resolveAsset(key: string, fallback: string) {
  return getPublicAssetUrl(key, fallback)
}
