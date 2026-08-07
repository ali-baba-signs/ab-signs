// Brand Colors
export const BRAND_COLORS = {
  PRIMARY: '#ED1B68', // Magenta
  DARK: '#231F20', // Dark/Black
  LIGHT: '#FFFFFF', // White
  GRAY_LIGHT: '#F5F5F5',
  GRAY_MEDIUM: '#E0E0E0',
} as const

// Product Categories
export const PRODUCT_CATEGORIES = [
  { id: 'custom_banners', name: 'Custom Banners', slug: 'custom-banners' },
  { id: 'mesh_banners', name: 'Mesh Banners', slug: 'mesh-banners' },
  { id: 'vinyl_banners', name: 'Vinyl Banners', slug: 'vinyl-banners' },
  { id: 'templates', name: 'Templates', slug: 'templates' },
  { id: 'digital_designs', name: 'Digital Designs', slug: 'digital-designs' },
] as const

// Order Status
export const ORDER_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PRODUCTION: 'production',
  QUALITY_CHECK: 'quality_check',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const

export const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  production: 'In Production',
  quality_check: 'Quality Check',
  ready_to_ship: 'Ready to Ship',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
} as const

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  CUSTOMER: 'customer',
  DESIGNER: 'designer',
} as const

// API Endpoints
export const API_ROUTES = {
  AUTH: '/api/auth',
  PRODUCTS: '/api/products',
  ORDERS: '/api/orders',
  DESIGNS: '/api/designs',
  USERS: '/api/users',
} as const

// Canvas Editor
export const CANVAS_DEFAULTS = {
  WIDTH: 1920,
  HEIGHT: 1080,
  BACKGROUND_COLOR: '#FFFFFF',
  ZOOM_MIN: 0.1,
  ZOOM_MAX: 5,
  DEFAULT_FONT_SIZE: 48,
  DEFAULT_FONT_FAMILY: 'Arial',
} as const

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const
