import { parseMeasurement } from '@/lib/measurements'

export const CUSTOM_PRODUCT_ID = 'custom_product'
export const CUSTOM_PRODUCT_NAME = 'Custom Artwork'
export const CUSTOM_PRODUCT_SKU = 'CUSTOM-ARTWORK'
export const CUSTOM_UNITS = ['mm', 'cm', 'm', 'in', 'ft'] as const
export type CustomUnit = typeof CUSTOM_UNITS[number]

const metresPerUnit: Record<CustomUnit, number> = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 }

export function customDimensions(width: unknown, height: unknown, unit: unknown) {
  if (typeof unit !== 'string' || !CUSTOM_UNITS.includes(unit as CustomUnit)) throw new Error('Select a valid custom size unit.')
  const customUnit = unit as CustomUnit
  const customWidth = parseMeasurement(width, 'Custom width').normalized
  const customHeight = parseMeasurement(height, 'Custom height').normalized
  const areaM2 = Number(customWidth) * Number(customHeight) * metresPerUnit[customUnit] ** 2
  if (!Number.isFinite(areaM2) || areaM2 <= 0 || areaM2 > 10000) throw new Error('Custom dimensions exceed the supported print area.')
  return { customWidth, customHeight, customUnit, areaM2 }
}

export function customArtworkRate(configuredValue: unknown) {
  const rate = Number(configuredValue)
  if (configuredValue === null || configuredValue === undefined || !Number.isFinite(rate) || rate <= 0 || rate > 100000) throw new Error('Set a positive Custom Artwork price per m² in admin settings.')
  return rate
}

export function customArtworkPrice(width: unknown, height: unknown, unit: unknown, rate: number) {
  return Math.round(customDimensions(width, height, unit).areaM2 * rate * 100) / 100
}
