export const R2_PATHS = {
  homepageHeroDesktop: 'homepage/hero/desktop',
  homepageHeroMobile: 'homepage/hero/mobile',
  homepageCategories: 'homepage/categories',
  homepagePromotionsDesktop: 'homepage/promotions/desktop',
  homepagePromotionsMobile: 'homepage/promotions/mobile',
  homepageProducts: 'homepage/products',
  homepageCollections: 'homepage/collections',
  homepageShowcase: 'homepage/showcase',
  homepageBlog: 'homepage/blog',
  offers: 'offers',
  products: 'products',
  editorTemplates: 'design-editor/templates',
  editorGraphics: 'design-editor/graphics',
  editorBackgrounds: 'design-editor/backgrounds',
  editorFonts: 'design-editor/fonts',
  userUploads: 'uploads/users',
  designUploads: 'uploads/designs',
  artworkUploads: 'uploads/artwork',
  designPreviews: 'generated/previews',
  designThumbnails: 'generated/thumbnails',
  printFiles: 'generated/print',
  orderDocuments: 'orders',
  siteAssets: 'site',
} as const

export type UploadPurpose =
  | 'design-artwork'
  | 'design-draft'
  | 'design-preview'
  | 'design-production'
  | 'logo'
  | 'template'
  | 'homepage'
  | 'offer-image'
  | 'product-image'
  | 'order-document'

export const ADMIN_UPLOAD_PURPOSES = new Set<UploadPurpose>([
  'template',
  'homepage',
  'offer-image',
  'product-image',
  'order-document',
])
