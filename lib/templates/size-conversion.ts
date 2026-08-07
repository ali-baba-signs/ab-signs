export type MeasurementUnit = 'mm' | 'cm' | 'in' | 'ft' | 'm'

const millimetres: Record<MeasurementUnit, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8, m: 1000 }

export function createTemplateCanvasSize(width: number, height: number, unit: MeasurementUnit) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 100000 || height > 100000) throw new Error('Template width and height must be positive and reasonable.')
  if (!millimetres[unit]) throw new Error('Template measurement unit is invalid.')
  const widthMm = width * millimetres[unit]
  const heightMm = height * millimetres[unit]
  const ratio = widthMm / heightMm
  const maxSide = 1200
  const logicalCanvasWidth = ratio >= 1 ? maxSide : Math.max(200, Math.round(maxSide * ratio))
  const logicalCanvasHeight = ratio >= 1 ? Math.max(200, Math.round(maxSide / ratio)) : maxSide
  return { widthMm, heightMm, logicalCanvasWidth, logicalCanvasHeight, pixelsPerMm: logicalCanvasWidth / widthMm }
}
