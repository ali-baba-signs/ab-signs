import { validateFabricCanvasData } from './svg-sanitization'
import { createTemplateCanvasSize, type MeasurementUnit } from './size-conversion'
import { parseMeasurement } from '@/lib/measurements'

export type TemplateAssetName = 'previewImage' | 'svg'
export interface TemplateAssetInput { id: string; key: string; url?: string; filename?: string }
export interface TemplateInput {
  name: string
  description: string
  productId: string
  categoryId: string
  status: 'draft' | 'active' | 'inactive'
  assets: Partial<Record<TemplateAssetName, TemplateAssetInput | null>>
  width: string
  height: string
  unit: MeasurementUnit
  logicalCanvasWidth: number
  logicalCanvasHeight: number
  canvasData: Record<string, unknown> | null
  scaleMetadata: Record<string, unknown> | null
  svgChecksum: string
  conversionVersion: number
  regenerate: boolean
}

const statuses = new Set(['draft', 'active', 'inactive'])
const units = new Set<MeasurementUnit>(['mm', 'cm', 'in', 'ft', 'm'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateTemplateInput(value: unknown, requireGeneratedData = true): TemplateInput {
  const input = value as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 255) : ''
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 5000) : ''
  const productId = typeof input.productId === 'string' ? input.productId : ''
  const categoryId = typeof input.categoryId === 'string' ? input.categoryId : ''
  const status = typeof input.status === 'string' && statuses.has(input.status) ? input.status as TemplateInput['status'] : 'draft'
  if (name.length < 2) throw new Error('Template name must contain at least two characters.')
  if (!uuid.test(categoryId)) throw new Error('Select a valid product category.')
  if (!uuid.test(productId)) throw new Error('Select a valid product for this template.')
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
  const widthMeasurement = parseMeasurement(input.width, 'Base artwork width')
  const heightMeasurement = parseMeasurement(input.height, 'Base artwork height')
  const width = widthMeasurement.normalized
  const height = heightMeasurement.normalized
  const unit = units.has(input.unit as MeasurementUnit) ? input.unit as MeasurementUnit : 'mm'
  const canvasSize = createTemplateCanvasSize(widthMeasurement.value, heightMeasurement.value, unit)
  const canvasData = input.canvasData ? validateFabricCanvasData(input.canvasData) : null
  if (requireGeneratedData && !canvasData) throw new Error('Generate editable Fabric data from the SVG before saving.')
  const scaleMetadata = input.scaleMetadata && typeof input.scaleMetadata === 'object' ? input.scaleMetadata as Record<string, unknown> : null
  const svgChecksum = typeof input.svgChecksum === 'string' && /^[a-f0-9]{64}$/i.test(input.svgChecksum) ? input.svgChecksum.toLowerCase() : ''
  const conversionVersion = Math.max(1, Math.min(1000, Math.floor(Number(input.conversionVersion) || 1)))
  return { name, description, productId, categoryId, status, assets, width, height, unit, logicalCanvasWidth: canvasSize.logicalCanvasWidth, logicalCanvasHeight: canvasSize.logicalCanvasHeight, canvasData, scaleMetadata, svgChecksum, conversionVersion, regenerate: input.regenerate === true }
}
