import { users, orders, products, designs, productVariants } from '@/lib/db/schema'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

// User Types
export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>

// Product Types
export type Product = InferSelectModel<typeof products>
export type NewProduct = InferInsertModel<typeof products>

export type ProductVariant = InferSelectModel<typeof productVariants>
export type NewProductVariant = InferInsertModel<typeof productVariants>

// Order Types
export type Order = InferSelectModel<typeof orders>
export type NewOrder = InferInsertModel<typeof orders>

// Design Types
export type Design = InferSelectModel<typeof designs>
export type NewDesign = InferInsertModel<typeof designs>

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Session Types
export interface SessionUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'customer' | 'designer'
  emailVerified: boolean
}

export interface AuthSession {
  user: SessionUser
  expiresAt: Date
}

// Design Editor Types
export interface CanvasElement {
  id: string
  type: 'text' | 'image' | 'shape'
  left: number
  top: number
  width: number
  height: number
  angle: number
  fill?: string
  stroke?: string
  opacity: number
}

export interface CanvasData {
  version: string
  width: number
  height: number
  backgroundColor?: string
  elements: CanvasElement[]
  metadata?: {
    productVariantId?: string
    productId?: string
    name?: string
  }
}

// Product Configurator Types
export interface ProductConfiguration {
  productId: string
  variantId: string
  quantity: number
  designId?: string
  specifications?: Record<string, string>
}

// Order Types
export interface OrderItem {
  productId: string
  variantId: string
  designId?: string
  quantity: number
  specifications?: Record<string, string>
}

export interface CreateOrderRequest {
  items: OrderItem[]
  shippingAddress: {
    name: string
    email: string
    phone: string
    address: string
    suburb: string
    state: string
    postalCode: string
    country: string
  }
  notes?: string
}
