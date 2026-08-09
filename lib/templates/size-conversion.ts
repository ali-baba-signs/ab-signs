export type MeasurementUnit = 'mm' | 'cm' | 'in' | 'ft' | 'm'
import { parseMeasurement } from '@/lib/measurements'

const millimetres: Record<MeasurementUnit, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8, m: 1000 }

export function createTemplateCanvasSize(width: number, height: number, unit: MeasurementUnit) {
  const safeWidth = parseMeasurement(width, 'Template width').value
  const safeHeight = parseMeasurement(height, 'Template height').value
  if (!millimetres[unit]) throw new Error('Template measurement unit is invalid.')
  const widthMm = safeWidth * millimetres[unit]
  const heightMm = safeHeight * millimetres[unit]
  const ratio = widthMm / heightMm
  const maxSide = 1200
  const logicalCanvasWidth = ratio >= 1 ? maxSide : Math.max(200, Math.round(maxSide * ratio))
  const logicalCanvasHeight = ratio >= 1 ? Math.max(200, Math.round(maxSide / ratio)) : maxSide
  return { widthMm, heightMm, logicalCanvasWidth, logicalCanvasHeight, pixelsPerMm: logicalCanvasWidth / widthMm }
}
