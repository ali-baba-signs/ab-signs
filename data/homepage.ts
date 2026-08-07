import { getPublicAssetUrl } from '@/lib/storage/r2-public-url'

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

export interface PromoBanner {
  id: string
  title: string
  subtitle: string
  desktopImageKey: string
  mobileImageKey: string
  fallbackImage: string
  href: string
  buttonLabel: string
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
    href: '/products?category=vinyl_banners',
    children: [
      { name: 'Vinyl Banners', href: '/products?category=vinyl_banners' },
      { name: 'Mesh Banners', href: '/products?category=mesh_banners' },
      { name: 'All Banners', href: '/products' },
    ],
  },
  {
    id: 'mesh',
    name: 'Mesh Banners',
    href: '/products?category=mesh_banners',
    children: [{ name: 'Browse Mesh Banners', href: '/products?category=mesh_banners' }],
  },
  {
    id: 'flags',
    name: 'Flags',
    href: '/products?category=flag',
    children: [{ name: 'Feather Flags', href: '/products?category=flag' }],
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

export const catalogHighlights = [
  { id: '1', name: 'Custom Vinyl Banner', description: 'Customisable vinyl banner for indoor or outdoor messaging.', image: '/vnyl banner.png', href: '/products/1' },
  { id: '2', name: 'Mesh Banner', description: 'A practical banner option for fences and breezy environments.', image: '/mesh banner.png', href: '/products/2' },
  { id: '3', name: 'Premium Feather Flag', description: 'A high-visibility portable flag display for your brand.', image: '/feather flag.png', href: '/products/3' },
]

export const promotions: PromoBanner[] = [
  {
    id: 'business-banners',
    title: 'Promote your business with custom banners',
    subtitle: 'Choose a product, set your size and bring your campaign artwork to life.',
    desktopImageKey: 'homepage/promotions/desktop/business-banners.png',
    mobileImageKey: 'homepage/promotions/mobile/business-banners.png',
    fallbackImage: '/vnyl banner.png',
    href: '/products?category=vinyl_banners',
    buttonLabel: 'Explore banners',
  },
  {
    id: 'flags',
    title: 'Put your brand in motion',
    subtitle: 'Create portable feather flags for entries, events and outdoor promotions.',
    desktopImageKey: 'homepage/promotions/desktop/custom-flags.png',
    mobileImageKey: 'homepage/promotions/mobile/custom-flags.png',
    fallbackImage: '/feather flag.png',
    href: '/products?category=flag',
    buttonLabel: 'Explore flags',
  },
]

export const benefits = [
  { title: 'Print-focused quality', description: 'Artwork tools and product options designed around signage production.' },
  { title: 'Custom dimensions', description: 'Configure a format suited to your message and installation.' },
  { title: 'Online design tools', description: 'Start blank or customise an editable template in your browser.' },
  { title: 'Australia-wide service', description: 'A streamlined online ordering experience for Australian customers.' },
]

export function resolveAsset(key: string, fallback: string) {
  return getPublicAssetUrl(key, fallback)
}
