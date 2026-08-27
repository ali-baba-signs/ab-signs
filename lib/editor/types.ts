import type { FabricObject } from 'fabric'

export type EditorSection =
  | 'product'
  | 'templates'
  | 'text'
  | 'uploads'
  | 'graphics'
  | 'background'
  | 'layers'

export interface ProductConfig {
  widthMm: number
  heightMm: number
  bleedMm: number
  safeMarginMm: number
  trimMarks?: boolean
  logicalCanvasWidth: number
  logicalCanvasHeight: number
  measurementUnit?: 'mm' | 'cm' | 'in' | 'ft' | 'm'
  sideMode?: 'single' | 'double'
  productId?: string
  productCategory?: 'banner' | 'flag'
  selectedSizeId?: string
  templateReference?: string
  productionGuideVersion?: number
}

export interface DesignTemplate {
  id: string
  name: string
  slug?: string
  category: string
  productType: string
  thumbnail: string
  jsonFile: string
  previewKey?: string
  jsonKey?: string
  tags?: string[]
  enabled?: boolean
  width: number
  height: number
  productId?: string
  sizeId?: string
}

export interface SavedDesign {
  version: 1 | 2
  productConfig: ProductConfig
  templateId: string | null
  canvasJson: Record<string, unknown>
  objectsJson?: unknown[]
  sides?: { front: { canvasJson: Record<string, unknown> }; back?: { canvasJson: Record<string, unknown> } }
  updatedAt: string
}

export type EditorObject = FabricObject & {
  id?: string
  name?: string
  role?: string
  locked?: boolean
  placeholder?: boolean
  excludeFromExport?: boolean
  assetKey?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: string
  charSpacing?: number
  textAlign?: string
}

export const CUSTOM_PROPERTIES = [
  'id',
  'name',
  'role',
  'locked',
  'placeholder',
  'excludeFromExport',
  'assetKey',
] as const
