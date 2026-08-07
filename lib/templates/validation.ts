import { validateFabricCanvasData } from './svg-sanitization'
import { createTemplateCanvasSize, type MeasurementUnit } from './size-conversion'

export type TemplateAssetName = 'previewImage' | 'svg'
export interface TemplateAssetInput { id: string; key: string; url?: string; filename?: string }
export interface TemplateSizeInput { id?: string; label: string; width: number; height: number; unit: MeasurementUnit; fitMode: 'contain' | 'cover' | 'stretch'; safeMargin: number; enabled: boolean; isDefault: boolean; displayOrder: number }
export interface TemplateInput {
  name: string
  description: string
  category: 'custom_banners' | 'mesh_banners' | 'vinyl_banners' | 'templates' | 'digital_designs' | null
  status: 'draft' | 'active' | 'inactive'
  assets: Partial<Record<TemplateAssetName, TemplateAssetInput | null>>
  width: number
  height: number
  unit: MeasurementUnit
  logicalCanvasWidth: number
  logicalCanvasHeight: number
  canvasData: Record<string, unknown> | null
  scaleMetadata: Record<string, unknown> | null
  sizes: TemplateSizeInput[]
  svgChecksum: string
  conversionVersion: number
  regenerate: boolean
}

const categories = new Set(['custom_banners', 'mesh_banners', 'vinyl_banners', 'templates', 'digital_designs'])
const statuses = new Set(['draft', 'active', 'inactive'])
const units = new Set<MeasurementUnit>(['mm', 'cm', 'in', 'ft', 'm'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateTemplateInput(value: unknown, requireGeneratedData = true): TemplateInput {
  const input = value as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 255) : ''
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 5000) : ''
  const category = typeof input.category === 'string' && categories.has(input.category) ? input.category as TemplateInput['category'] : null
  const status = typeof input.status === 'string' && statuses.has(input.status) ? input.status as TemplateInput['status'] : 'draft'
  if (name.length < 2) throw new Error('Template name must contain at least two characters.')
  const rawAssets = input.assets && typeof input.assets === 'object' ? input.assets as Record<string, unknown> : {}
  const assets: TemplateInput['assets'] = {}
  for (const field of ['previewImage', 'svg'] as const) {
    const raw = rawAssets[field]
    if (raw === null) { assets[field] = null; continue }
    if (raw && typeof raw === 'object') {
      const asset = raw as Record<string, unknown>
      if (typeof asset.id !== 'string' || !uuid.test(asset.id) || typeof asset.key !== 'string' || !asset.key.startsWith('design-editor/templates/')) throw new Error(`The ${field} asset reference is invalid.`)
      assets[field] = { id: asset.id, key: asset.key, url: typeof asset.url === 'string' ? asset.url : undefined, filename: typeof asset.filename === 'string' ? asset.filename.slice(0, 255) : undefined }
    }
  }
  const width = Number(input.width)
  const height = Number(input.height)
  const unit = units.has(input.unit as MeasurementUnit) ? input.unit as MeasurementUnit : 'mm'
  const canvasSize = createTemplateCanvasSize(width, height, unit)
  const canvasData = input.canvasData ? validateFabricCanvasData(input.canvasData) : null
  if (requireGeneratedData && !canvasData) throw new Error('Generate editable Fabric data from the SVG before saving.')
  const scaleMetadata = input.scaleMetadata && typeof input.scaleMetadata === 'object' ? input.scaleMetadata as Record<string, unknown> : null
  const rawSizes = Array.isArray(input.sizes) && input.sizes.length ? input.sizes : [{ label: `${width} x ${height} ${unit}`, width, height, unit, fitMode: 'contain', safeMargin: 0, enabled: true, isDefault: true, displayOrder: 0 }]
  if (rawSizes.length > 30) throw new Error('A template can support at most 30 sizes.')
  const sizes = rawSizes.map((raw, index) => {
    const row = raw as Record<string, unknown>
    const sizeUnit = units.has(row.unit as MeasurementUnit) ? row.unit as MeasurementUnit : unit
    createTemplateCanvasSize(Number(row.width), Number(row.height), sizeUnit)
    const label = typeof row.label === 'string' ? row.label.trim().slice(0, 120) : ''
    if (!label) throw new Error(`Template size ${index + 1} needs a label.`)
    const fitMode = ['contain', 'cover', 'stretch'].includes(String(row.fitMode)) ? String(row.fitMode) as TemplateSizeInput['fitMode'] : 'contain'
    const safeMargin = Number(row.safeMargin ?? 0)
    if (!Number.isFinite(safeMargin) || safeMargin < 0) throw new Error(`Template size ${index + 1} has an invalid safe margin.`)
    return { id: typeof row.id === 'string' && uuid.test(row.id) ? row.id : undefined, label, width: Number(row.width), height: Number(row.height), unit: sizeUnit, fitMode, safeMargin, enabled: row.enabled !== false, isDefault: Boolean(row.isDefault), displayOrder: index }
  })
  if (sizes.filter((size) => size.isDefault).length !== 1) sizes.forEach((size, index) => { size.isDefault = index === 0 })
  const svgChecksum = typeof input.svgChecksum === 'string' && /^[a-f0-9]{64}$/i.test(input.svgChecksum) ? input.svgChecksum.toLowerCase() : ''
  const conversionVersion = Math.max(1, Math.min(1000, Math.floor(Number(input.conversionVersion) || 1)))
  return { name, description, category, status, assets, width, height, unit, logicalCanvasWidth: canvasSize.logicalCanvasWidth, logicalCanvasHeight: canvasSize.logicalCanvasHeight, canvasData, scaleMetadata, sizes, svgChecksum, conversionVersion, regenerate: input.regenerate === true }
}
