import { sanitizeRichText, richTextToPlainText } from '@/lib/content/sanitize-html'
import { parseMeasurement } from '@/lib/measurements'
import { FLAG_PRINT_PRESETS, FLAG_SIZE_GROUPS, FLAG_TYPES, PRODUCT_SIZE_MODES, SIDE_MODES, type ProductSizeMode } from './size-presets'
import { FLAG_BLEED_MM, FLAG_SAFETY_MM } from '@/lib/production/production-spec'

export interface ProductImageInput {
  id?: string
  key?: string
  assetId?: string
  url?: string
  alt?: string
  isPrimary?: boolean
  order?: number
}

export interface ProductSizeInput {
  id?: string
  label: string
  width?: number | string | null
  height?: number | string | null
  unit: string
  unitPrice: number | string
  enabled: boolean
  order?: number
  variantType?: string | null
  sizeGroup?: string | null
  sideMode?: string
  assembledHeightDescription?: string | null
  fitMode?: string
  safeMargin?: number | string
  bleed?: number | string
  trimMarks?: boolean
  isDefault?: boolean
  frontTemplateId?: string | null
  backTemplateId?: string | null
}

export interface ValidProductInput {
  sku: string
  name: string
  description: string
  basePrice: number
  categoryId: string
  templateId: string | null
  featured: boolean
  active: boolean
  sizeMode: ProductSizeMode
  allowCustomDimensions: boolean
  freeShipping: boolean
  images: ProductImageInput[]
  sizes: Array<Omit<ProductSizeInput, 'width' | 'height' | 'unitPrice' | 'safeMargin' | 'bleed'> & { width: string | null; height: string | null; unitPrice: number; variantType: typeof FLAG_TYPES[number] | null; sizeGroup: typeof FLAG_SIZE_GROUPS[number] | null; sideMode: typeof SIDE_MODES[number]; fitMode: 'contain' | 'cover' | 'stretch'; safeMargin: string; bleed: string; trimMarks: boolean; isDefault: boolean }>
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function money(value: unknown, label: string) {
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0 || result > 1000000) throw new Error(`${label} must be a valid non-negative amount.`)
  return Math.round(result * 100) / 100
}

function optionalDimension(value: unknown, label: string) {
  if (value === '' || value === null || value === undefined) return null
  return parseMeasurement(value, label).normalized
}

function nonNegativeDimension(value: unknown, label: string) {
  if (value === 0 || value === '0' || value === '' || value === null || value === undefined) return '0'
  return parseMeasurement(value, label).normalized
}

export function validateProductInput(value: unknown): ValidProductInput {
  const input = value as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 255) : ''
  const sku = typeof input.sku === 'string' ? input.sku.trim().toUpperCase().slice(0, 100) : ''
  const categoryId = typeof input.categoryId === 'string' ? input.categoryId : ''
  const templateId = null
  const sizeMode = PRODUCT_SIZE_MODES.includes(input.sizeMode as ProductSizeMode) ? input.sizeMode as ProductSizeMode : 'preset_sizes'
  if (name.length < 2) throw new Error('Product name must contain at least two characters.')
  if (!/^[A-Z0-9][A-Z0-9._-]{1,99}$/.test(sku)) throw new Error('SKU must contain letters, numbers, dots, dashes, or underscores.')
  if (!uuid.test(categoryId)) throw new Error('Select a valid product category.')
  const description = sanitizeRichText(input.description)
  if (richTextToPlainText(description).length < 10) throw new Error('Description must contain at least 10 characters.')

  const images = Array.isArray(input.images) ? input.images.slice(0, 12).map((raw, order) => {
    const image = raw as ProductImageInput
    if (!image.id && (!image.key || image.url?.startsWith('blob:'))) throw new Error(`Image ${order + 1} has not finished uploading.`)
    if (image.assetId && !uuid.test(image.assetId)) throw new Error(`Image ${order + 1} has an invalid asset reference.`)
    return { id: image.id, key: image.key, assetId: image.assetId, url: image.url, alt: (image.alt || name).trim().slice(0, 255), isPrimary: Boolean(image.isPrimary), order }
  }) : []
  if (new Set(images.flatMap((image) => image.key ? [image.key] : [])).size !== images.filter((image) => image.key).length) throw new Error('The same uploaded image cannot be added twice.')
  if (images.length === 0) throw new Error('Add at least one product image.')
  if (!images.some((image) => image.isPrimary)) images[0].isPrimary = true
  let foundPrimary = false
  images.forEach((image) => { image.isPrimary = image.isPrimary && !foundPrimary; if (image.isPrimary) foundPrimary = true })

  const sizes = (Array.isArray(input.sizes) ? input.sizes as ProductSizeInput[] : []).slice(0, 30).map((size, order) => {
    const label = typeof size.label === 'string' ? size.label.trim().slice(0, 120) : ''
    const unit = typeof size.unit === 'string' && ['mm', 'cm', 'in', 'ft', 'm'].includes(size.unit) ? size.unit : ''
    if (!label) throw new Error(`Size ${order + 1} needs a label.`)
    if (!unit) throw new Error(`Size ${order + 1} has an invalid measurement unit.`)
    const variantType = FLAG_TYPES.includes(size.variantType as typeof FLAG_TYPES[number]) ? size.variantType as typeof FLAG_TYPES[number] : null
    const sizeGroup = FLAG_SIZE_GROUPS.includes(size.sizeGroup as typeof FLAG_SIZE_GROUPS[number]) ? size.sizeGroup as typeof FLAG_SIZE_GROUPS[number] : null
    const sideMode = SIDE_MODES.includes(size.sideMode as typeof SIDE_MODES[number]) ? size.sideMode as typeof SIDE_MODES[number] : 'single'
    const frontTemplateId = typeof size.frontTemplateId === 'string' && uuid.test(size.frontTemplateId) ? size.frontTemplateId : null
    const backTemplateId = typeof size.backTemplateId === 'string' && uuid.test(size.backTemplateId) ? size.backTemplateId : null
    if (sizeMode === 'fixed_variants' && (!variantType || !sizeGroup || !size.width || !size.height)) throw new Error(`${label} must define flag type, size group, side mode, and real print dimensions.`)
    const width = optionalDimension(size.width, `${label} width`)
    const height = optionalDimension(size.height, `${label} height`)
    if (sideMode === 'double' && backTemplateId && !frontTemplateId) throw new Error(`${label} needs a front template when a back template is selected.`)
    const fitMode = ['contain', 'cover', 'stretch'].includes(String(size.fitMode)) ? size.fitMode as 'contain' | 'cover' | 'stretch' : 'contain'
    const safeMargin = variantType ? String(FLAG_SAFETY_MM) : nonNegativeDimension(size.safeMargin ?? 0, `${label} safe margin`)
    const bleed = variantType ? String(FLAG_BLEED_MM) : nonNegativeDimension(size.bleed ?? 3, `${label} bleed`)
    return { id: typeof size.id === 'string' && uuid.test(size.id) ? size.id : undefined, label, width, height, unit, unitPrice: money(size.unitPrice, `${label} price`), enabled: Boolean(size.enabled), order, variantType, sizeGroup, sideMode, assembledHeightDescription: typeof size.assembledHeightDescription === 'string' ? size.assembledHeightDescription.trim().slice(0,255) || null : sizeGroup ? FLAG_PRINT_PRESETS[sizeGroup].assembledHeightDescription : null, fitMode, safeMargin, bleed, trimMarks: size.trimMarks !== false, isDefault: Boolean(size.isDefault), frontTemplateId, backTemplateId }
  })
  if (!sizes.some((size) => size.enabled)) throw new Error('Enable at least one product size or fixed variant.')
  const enabledDefaults = sizes.filter((size) => size.enabled && size.isDefault)
  if (enabledDefaults.length !== 1) sizes.forEach((size, index) => { size.isDefault = size.enabled && index === sizes.findIndex((candidate) => candidate.enabled) })
  return { sku, name, description, basePrice: money(input.basePrice, 'Base price'), categoryId, templateId, sizeMode, allowCustomDimensions: ['preset_sizes','custom_dimensions'].includes(sizeMode) && input.allowCustomDimensions === true, freeShipping: input.freeShipping === true, featured: Boolean(input.featured), active: input.active !== false, images, sizes }
}
