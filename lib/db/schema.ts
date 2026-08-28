import { pgTable, text, timestamp, integer, boolean, decimal, varchar, json, pgEnum, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { HeroStyleConfig } from '@/lib/home/hero-style'

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'customer', 'designer'])
export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'confirmed', 'production', 'ready_to_ship', 'shipped',
  'pending_design_confirmation', 'design_revision_required', 'design_confirmed',
  'awaiting_payment_confirmation', 'awaiting_payment', 'payment_confirmed', 'order_confirmed',
  'in_production', 'queued_for_printing', 'printing', 'printing_completed',
  'quality_check', 'production_completed', 'print_ready', 'ready_for_pickup',
  'awaiting_dispatch', 'ready_for_dispatch', 'dispatched', 'out_for_delivery', 'delivered', 'completed', 'on_hold',
  'cancelled', 'refund_requested', 'refunded',
])
export const productCategoryEnum = pgEnum('product_category', ['custom_banners', 'mesh_banners', 'vinyl_banners', 'templates', 'digital_designs'])

// Users Table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  image: text('image'),
  role: userRoleEnum('role').default('customer').notNull(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
})

// Better Auth uses a separate security boundary for administrators.
export const adminUsers = pgTable('admin_users', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  image: text('image'),
  role: varchar('role', { length: 30 }).default('admin').notNull(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
})

export const storageAssets = pgTable('storage_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  objectKey: text('object_key').unique().notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  folder: text('folder').notNull(),
  contentType: varchar('content_type', { length: 160 }).notNull(),
  size: integer('size_bytes').default(0).notNull(),
  etag: varchar('etag', { length: 255 }),
  access: varchar('access', { length: 20 }).default('public').notNull(),
  status: varchar('status', { length: 30 }).default('available').notNull(),
  uploadedBy: text('uploaded_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('storage_assets_folder_idx').on(table.folder), index('storage_assets_seen_idx').on(table.lastSeenAt)])

// User Profiles
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  company: varchar('company', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  alternatePhone: varchar('alternate_phone', { length: 20 }),
  address: text('address'),
  city: varchar('city', { length: 255 }),
  state: varchar('state', { length: 255 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 255 }),
  deliveryInstructions: text('delivery_instructions'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const customerAddresses = pgTable('customer_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 80 }).default('Address').notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  alternatePhone: varchar('alternate_phone', { length: 30 }),
  addressLine1: text('address_line_1').notNull(),
  addressLine2: text('address_line_2'),
  city: varchar('city', { length: 160 }).notNull(),
  region: varchar('region', { length: 160 }),
  postalCode: varchar('postal_code', { length: 30 }).notNull(),
  country: varchar('country', { length: 160 }).notNull(),
  deliveryInstructions: text('delivery_instructions'),
  defaultShipping: boolean('default_shipping').default(false).notNull(),
  defaultBilling: boolean('default_billing').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('customer_addresses_user_idx').on(table.userId)])

// Sessions (Better Auth)
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').unique().notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
})

// Product Categories
export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  description: text('description'),
  category: productCategoryEnum('category').notNull(),
  imageAssetId: uuid('image_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  enabled: boolean('enabled').default(true).notNull(),
  showOnHomepage: boolean('show_on_homepage').default(false).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Products
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => productCategories.id),
  sku: varchar('sku', { length: 100 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
  // Referential integrity is created by the migration. Keeping this column
  // reference-free here avoids a circular declaration with `templates`.
  templateId: uuid('template_id'),
  designMode: varchar('design_mode', { length: 20 }).default('single_side').notNull(),
  sizeMode: varchar('size_mode', { length: 30 }).default('preset_sizes').notNull(),
  allowCustomDimensions: boolean('allow_custom_dimensions').default(false).notNull(),
  freeShipping: boolean('free_shipping').default(false).notNull(),
  materials: json('materials'),
  printTypes: json('print_types'),
  featured: boolean('featured').default(false),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Product Variants
export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  dimensions: varchar('dimensions', { length: 100 }),
  material: varchar('material', { length: 100 }),
  printType: varchar('print_type', { length: 100 }),
  priceModifier: decimal('price_modifier', { precision: 10, scale: 2 }).default('0'),
  stock: integer('stock').default(0),
  sku: varchar('sku', { length: 100 }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Product Images
export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  storageKey: text('storage_key'),
  assetId: uuid('asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  alt: varchar('alt', { length: 255 }),
  isPrimary: boolean('is_primary').default(false),
  order: integer('order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const productSizes = pgTable('product_sizes', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 120 }).notNull(),
  width: decimal('width', { precision: 10, scale: 2 }),
  height: decimal('height', { precision: 10, scale: 2 }),
  unit: varchar('unit', { length: 20 }).default('in').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  order: integer('sort_order').default(0).notNull(),
  variantType: varchar('variant_type', { length: 30 }),
  sizeGroup: varchar('size_group', { length: 20 }),
  sideMode: varchar('side_mode', { length: 10 }).default('single').notNull(),
  assembledHeightDescription: varchar('assembled_height_description', { length: 255 }),
  fitMode: varchar('fit_mode', { length: 10 }).default('contain').notNull(),
  safeMargin: decimal('safe_margin', { precision: 10, scale: 3 }).default('0').notNull(),
  bleed: decimal('bleed', { precision: 10, scale: 3 }).default('3').notNull(),
  trimMarks: boolean('trim_marks').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  frontTemplateId: uuid('front_template_id'),
  backTemplateId: uuid('back_template_id'),
  designConfigurations: json('design_configurations').$type<Array<{
    designType: 'single_side' | 'double_side'
    enabled: boolean
    singleTemplateId?: string | null
    frontTemplateId?: string | null
    backTemplateId?: string | null
  }>>().default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('product_sizes_product_idx').on(table.productId)])

// Templates
export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  thumbnail: text('thumbnail'),
  previewImageUrl: text('preview_image_url'),
  previewImageKey: text('preview_image_key'),
  previewAssetId: uuid('preview_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  webmUrl: text('webm_url'),
  webmKey: text('webm_key'),
  jsonUrl: text('json_url'),
  jsonKey: text('json_key'),
  svgUrl: text('svg_url'),
  svgKey: text('svg_key'),
  svgAssetId: uuid('svg_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  fixedSvgUrl: text('fixed_svg_url'),
  fixedSvgKey: text('fixed_svg_key'),
  fixedSvgAssetId: uuid('fixed_svg_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  templateKind: varchar('template_kind', { length: 20 }).default('banner').notNull(),
  templateSide: varchar('template_side', { length: 10 }).default('single').notNull(),
  fixedCanvasData: json('fixed_canvas_data'),
  printableArea: json('printable_area'),
  physicalWidth: decimal('physical_width', { precision: 12, scale: 3 }),
  physicalHeight: decimal('physical_height', { precision: 12, scale: 3 }),
  measurementUnit: varchar('measurement_unit', { length: 10 }).default('mm'),
  logicalCanvasWidth: integer('logical_canvas_width'),
  logicalCanvasHeight: integer('logical_canvas_height'),
  scaleMetadata: json('scale_metadata'),
  templateVersion: integer('template_version').default(1).notNull(),
  svgChecksum: varchar('svg_checksum', { length: 64 }),
  conversionVersion: integer('conversion_version').default(1).notNull(),
  conversionStatus: varchar('conversion_status', { length: 20 }).default('pending').notNull(),
  conversionError: text('conversion_error'),
  generatedAt: timestamp('generated_at'),
  canvasData: json('canvas_data').notNull(),
  category: productCategoryEnum('category'),
  tags: json('tags'),
  status: varchar('status', { length: 30 }).default('draft').notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('templates_product_idx').on(table.productId), index('templates_status_product_idx').on(table.status, table.productId)])

export const templateProducts = pgTable('template_products', {
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('template_products_unique').on(table.templateId, table.productId), index('template_products_product_idx').on(table.productId)])

export const templateSizes = pgTable('template_sizes', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 120 }).notNull(),
  width: decimal('width', { precision: 12, scale: 3 }).notNull(),
  height: decimal('height', { precision: 12, scale: 3 }).notNull(),
  unit: varchar('unit', { length: 10 }).default('mm').notNull(),
  fitMode: varchar('fit_mode', { length: 10 }).default('contain').notNull(),
  safeMargin: decimal('safe_margin', { precision: 10, scale: 3 }).default('0').notNull(),
  bleed: decimal('bleed', { precision: 10, scale: 3 }).default('3').notNull(),
  trimMarks: boolean('trim_marks').default(true).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('template_sizes_template_idx').on(table.templateId), uniqueIndex('template_sizes_identity_idx').on(table.templateId, table.width, table.height, table.unit)])

export const productTemplateSizePrices = pgTable('product_template_size_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  templateSizeId: uuid('template_size_id').notNull().references(() => templateSizes.id, { onDelete: 'cascade' }),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('product_template_size_price_idx').on(table.productId, table.templateSizeId)])

// Designs
export const designs = pgTable('designs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  canvasData: json('canvas_data').notNull(),
  assetId: uuid('asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  previewAssetId: uuid('preview_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  frontPreviewAssetId: uuid('front_preview_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  backPreviewAssetId: uuid('back_preview_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  productionAssetId: uuid('production_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  thumbnail: text('thumbnail'),
  templateId: uuid('template_id').references(() => templates.id),
  productId: uuid('product_id').references(() => products.id),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const customerArtworks = pgTable('customer_artworks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  templateSizeId: uuid('template_size_id').references(() => templateSizes.id, { onDelete: 'restrict' }),
  productSizeId: uuid('product_size_id').references(() => productSizes.id, { onDelete: 'restrict' }),
  assetId: uuid('asset_id').notNull().references(() => storageAssets.id, { onDelete: 'restrict' }),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  notes: text('notes'),
  orientation: varchar('orientation', { length: 20 }),
  quantityReference: integer('quantity_reference'),
  status: varchar('status', { length: 20 }).default('ready').notNull(),
  sourceWidthPx: integer('source_width_px'),
  sourceHeightPx: integer('source_height_px'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('customer_artworks_user_idx').on(table.userId), index('customer_artworks_product_idx').on(table.productId)])

// Design Versions
export const designVersions = pgTable('design_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  designId: uuid('design_id').notNull().references(() => designs.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  canvasData: json('canvas_data').notNull(),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
})

// Orders
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderNumber: varchar('order_number', { length: 50 }).unique().notNull(),
  status: orderStatusEnum('status').default('pending_design_confirmation').notNull(),
  paymentStatus: varchar('payment_status', { length: 30 }).default('awaiting_payment').notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }),
  currency: varchar('currency', { length: 3 }).default('AUD').notNull(),
  customerEmail: varchar('customer_email', { length: 255 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 100 }).unique().notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),
  shippingAmount: decimal('shipping_amount', { precision: 10, scale: 2 }).default('0'),
  couponId: uuid('coupon_id'),
  couponSnapshot: json('coupon_snapshot'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  shippingAddress: json('shipping_address'),
  billingAddress: json('billing_address'),
  deliveryType: varchar('delivery_type', { length: 20 }).default('delivery').notNull(),
  notes: text('notes'),
  designConfirmationDeadline: timestamp('design_confirmation_deadline'),
  designConfirmedAt: timestamp('design_confirmed_at'),
  designConfirmationOnTime: boolean('design_confirmation_on_time'),
  designDelayReason: text('design_delay_reason'),
  expectedPrintingAt: timestamp('expected_printing_at'),
  expectedDeliveryAt: timestamp('expected_delivery_at'),
  dispatchedAt: timestamp('dispatched_at'),
  deliveredAt: timestamp('delivered_at'),
  deliveredByAdminId: text('delivered_by_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  deliveryNote: text('delivery_note'),
  expectedPickupAt: timestamp('expected_pickup_at'),
  readyForPickupAt: timestamp('ready_for_pickup_at'),
  pickupCompletedAt: timestamp('pickup_completed_at'),
  courierName: varchar('courier_name', { length: 120 }),
  trackingNumber: varchar('tracking_number', { length: 160 }),
  internalNotes: text('internal_notes'),
  customerNotes: text('customer_notes'),
  policiesAccepted: boolean('policies_accepted').default(false).notNull(),
  policiesAcceptedAt: timestamp('policies_accepted_at'),
  policyAcceptance: json('policy_acceptance'),
  receiptAssetId: uuid('receipt_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Order Items
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  productSizeId: uuid('product_size_id').references(() => productSizes.id, { onDelete: 'set null' }),
  templateSizeId: uuid('template_size_id').references(() => templateSizes.id, { onDelete: 'set null' }),
  templateId: uuid('template_id').references(() => templates.id),
  designId: uuid('design_id').references(() => designs.id),
  customerArtworkId: uuid('customer_artwork_id').references(() => customerArtworks.id, { onDelete: 'set null' }),
  previewAssetId: uuid('preview_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  frontPreviewAssetId: uuid('front_preview_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  backPreviewAssetId: uuid('back_preview_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  customerArtworkAssetId: uuid('customer_artwork_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  productionAssetId: uuid('production_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  designSource: varchar('design_source', { length: 30 }).default('design_assistance').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  specifications: json('specifications'),
})

export const paymentRecords = pgTable('payment_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 30 }).notNull(),
  mode: varchar('mode', { length: 20 }).default('test').notNull(),
  status: varchar('status', { length: 30 }).default('awaiting_payment').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  externalId: varchar('external_id', { length: 255 }),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('payment_records_order_idx').on(table.orderId), uniqueIndex('payment_records_order_provider_unique').on(table.orderId, table.provider), uniqueIndex('payment_records_external_unique').on(table.externalId)])

export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  eventId: varchar('event_id', { length: 255 }).primaryKey(),
  eventType: varchar('event_type', { length: 120 }).notNull(),
  objectId: varchar('object_id', { length: 255 }),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
})

export const orderEmailEvents = pgTable('order_email_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  status: varchar('status', { length: 20 }).default('processing').notNull(),
  attempts: integer('attempts').default(1).notNull(),
  providerMessageId: varchar('provider_message_id', { length: 500 }),
  error: text('error'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('order_email_events_unique').on(table.orderId, table.eventType), index('order_email_events_status_idx').on(table.status, table.updatedAt)])

// Coupons remain the one authoritative discount-code table. Presentation and
// eligibility live in related tables below so checkout has one pricing engine.
export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  description: text('description'),
  discountType: varchar('discount_type', { length: 20 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
  active: boolean('active').default(true).notNull(),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').default(0).notNull(),
  reservedCount: integer('reserved_count').default(0).notNull(),
  perCustomerUsageLimit: integer('per_customer_usage_limit'),
  minimumSubtotal: decimal('minimum_subtotal', { precision: 12, scale: 2 }),
  maxDiscountAmount: decimal('max_discount_amount', { precision: 12, scale: 2 }),
  visibility: varchar('visibility', { length: 20 }).default('private').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const couponProducts = pgTable('coupon_products', {
  couponId: uuid('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
}, (table) => [uniqueIndex('coupon_products_unique').on(table.couponId, table.productId)])

export const couponCategories = pgTable('coupon_categories', {
  couponId: uuid('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => productCategories.id, { onDelete: 'cascade' }),
}, (table) => [uniqueIndex('coupon_categories_unique').on(table.couponId, table.categoryId)])

// A customer-specific coupon is still a coupon; this table only scopes who may
// redeem it. Keeping the relationship separate avoids duplicating discount data.
export const couponCustomers = pgTable('coupon_customers', {
  couponId: uuid('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [uniqueIndex('coupon_customers_unique').on(table.couponId, table.userId), index('coupon_customers_user_idx').on(table.userId)])

export const couponReservations = pgTable('coupon_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  couponId: uuid('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).default('reserved').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  releasedAt: timestamp('released_at'),
  releaseReason: varchar('release_reason', { length: 80 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('coupon_reservations_order_unique').on(table.orderId), index('coupon_reservations_expiry_idx').on(table.status, table.expiresAt), index('coupon_reservations_customer_idx').on(table.couponId, table.userId)])

export const couponRedemptions = pgTable('coupon_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  couponId: uuid('coupon_id').notNull().references(() => coupons.id, { onDelete: 'restrict' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
  paymentRecordId: uuid('payment_record_id').references(() => paymentRecords.id, { onDelete: 'set null' }),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('redeemed').notNull(),
  redeemedAt: timestamp('redeemed_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('coupon_redemptions_order_unique').on(table.orderId), index('coupon_redemptions_customer_idx').on(table.couponId, table.userId)])

export const offers = pgTable('offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  couponId: uuid('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  shortDescription: text('short_description'),
  fullDescription: text('full_description'),
  terms: text('terms'),
  imageAssetId: uuid('image_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  mobileImageAssetId: uuid('mobile_image_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  imageUrl: text('image_url'),
  mobileImageUrl: text('mobile_image_url'),
  badgeText: varchar('badge_text', { length: 100 }),
  ctaLabel: varchar('cta_label', { length: 120 }),
  ctaUrl: text('cta_url'),
  showOnHomepage: boolean('show_on_homepage').default(false).notNull(),
  showInOffersPage: boolean('show_in_offers_page').default(true).notNull(),
  showInProfile: boolean('show_in_profile').default(true).notNull(),
  featured: boolean('featured').default(false).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('offers_visible_idx').on(table.enabled, table.showOnHomepage, table.displayOrder)])

export const storeSettings = pgTable('store_settings', {
  id: varchar('id', { length: 30 }).primaryKey().default('default'),
  values: json('values').notNull(),
  updatedBy: text('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const homepagePromotions = pgTable('homepage_promotions', {
  id: uuid('id').primaryKey().defaultRandom(),
  internalTitle: varchar('internal_title', { length: 255 }).notNull(),
  headline: varchar('headline', { length: 255 }).notNull(),
  description: text('description').notNull(),
  imageAssetId: uuid('image_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  imageUrl: text('image_url'),
  ctaLabel: varchar('cta_label', { length: 120 }),
  ctaUrl: text('cta_url'),
  alignment: varchar('alignment', { length: 20 }).default('image_left').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('homepage_promotions_enabled_order_idx').on(table.enabled, table.displayOrder)])

export const adminActivityLogs = pgTable('admin_activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: text('admin_user_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  adminName: varchar('admin_name', { length: 255 }).notNull(),
  actionType: varchar('action_type', { length: 80 }).notNull(),
  entityType: varchar('entity_type', { length: 80 }).notNull(),
  entityId: text('entity_id'),
  entityName: varchar('entity_name', { length: 255 }),
  description: text('description').notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [index('admin_activity_created_idx').on(table.createdAt), index('admin_activity_entity_idx').on(table.entityType, table.entityId)])

export const heroSlides = pgTable('hero_slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  offerId: uuid('offer_id').references(() => offers.id, { onDelete: 'restrict' }),
  desktopAssetId: uuid('desktop_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  mobileAssetId: uuid('mobile_asset_id').references(() => storageAssets.id, { onDelete: 'restrict' }),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  eyebrow: varchar('eyebrow', { length: 255 }),
  buttonLabel: varchar('button_label', { length: 120 }),
  buttonUrl: text('button_url'),
  altText: varchar('alt_text', { length: 255 }),
  horizontalAlignment: varchar('horizontal_alignment', { length: 10 }).default('left').notNull(),
  verticalAlignment: varchar('vertical_alignment', { length: 10 }).default('middle').notNull(),
  styleConfig: json('style_config').$type<HeroStyleConfig>().notNull(),
  featured: boolean('featured').default(true).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('hero_slides_display_idx').on(table.featured, table.enabled, table.displayOrder)])

export const contactSubmissions = pgTable('contact_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  company: varchar('company', { length: 255 }),
  orderNumber: varchar('order_number', { length: 80 }),
  enquiryType: varchar('enquiry_type', { length: 80 }),
  subject: varchar('subject', { length: 255 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 30 }).default('new').notNull(),
  emailStatus: varchar('email_status', { length: 30 }).default('pending').notNull(),
  emailError: text('email_error'),
  ipHash: varchar('ip_hash', { length: 64 }),
  userAgent: varchar('user_agent', { length: 500 }),
  readAt: timestamp('read_at'),
  resolvedAt: timestamp('resolved_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [index('contact_submissions_created_idx').on(table.createdAt), index('contact_submissions_ip_created_idx').on(table.ipHash, table.createdAt)])

// Order Status History
export const orderStatusHistory = pgTable('order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: orderStatusEnum('status').notNull(),
  previousStatus: orderStatusEnum('previous_status'),
  newStatus: orderStatusEnum('new_status'),
  notes: text('notes'),
  internalNote: text('internal_note'),
  customerVisibleNote: text('customer_visible_note'),
  expectedCompletionAt: timestamp('expected_completion_at'),
  actualCompletionAt: timestamp('actual_completion_at'),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
  changedBy: text('changed_by').references(() => users.id),
  changedByAdmin: text('changed_by_admin').references(() => adminUsers.id, { onDelete: 'set null' }),
})

export const productReviews = pgTable('product_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'cascade' }).unique(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  productQuality: integer('product_quality').notNull(),
  printQuality: integer('print_quality').notNull(),
  colourFinishQuality: integer('colour_finish_quality').notNull(),
  timeliness: integer('timeliness').notNull(),
  service: integer('service').notNull(),
  overall: integer('overall').notNull(),
  feedback: text('feedback'),
  verifiedPurchase: boolean('verified_purchase').default(true).notNull(),
  moderationStatus: varchar('moderation_status', { length: 20 }).default('pending').notNull(),
  moderatedBy: text('moderated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  moderatedAt: timestamp('moderated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('product_reviews_product_idx').on(table.productId), index('product_reviews_order_idx').on(table.orderId)])

export const policyDocuments = pgTable('policy_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 120 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  version: varchar('version', { length: 40 }).notNull(),
  content: json('content').notNull(),
  published: boolean('published').default(true).notNull(),
  effectiveAt: timestamp('effective_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('policy_documents_slug_version_idx').on(table.slug, table.version), index('policy_documents_published_idx').on(table.slug, table.published, table.effectiveAt)])

// Production Queue
export const productionQueue = pgTable('production_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id),
  status: varchar('status', { length: 50 }).default('queued').notNull(),
  assignedTo: text('assigned_to').references(() => users.id),
  priority: integer('priority').default(0),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Live Chat Messages
export const liveChatMessages = pgTable('live_chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  message: text('message').notNull(),
  isAdminMessage: boolean('is_admin_message').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// CMS Pages
export const cmsPages = pgTable('cms_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  metadata: json('metadata'),
  published: boolean('published').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles),
  sessions: many(sessions),
  designs: many(designs),
  orders: many(orders),
}))

export const productRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories),
  template: one(templates, { fields: [products.templateId], references: [templates.id] }),
  variants: many(productVariants),
  images: many(productImages),
  sizes: many(productSizes),
}))

export const orderRelations = relations(orders, ({ one, many }) => ({
  user: one(users),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
}))
