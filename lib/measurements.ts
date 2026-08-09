export const MEASUREMENT_SCALE = 1000

export function parseMeasurement(value: unknown, label = 'Measurement') {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!/^\d+(?:\.\d{1,3})?$/.test(raw)) throw new Error(`${label} must be a positive number with up to three decimal places.`)
  const [whole, fraction = ''] = raw.split('.')
  const scaled = BigInt(whole) * BigInt(MEASUREMENT_SCALE) + BigInt(fraction.padEnd(3, '0'))
  const zero = BigInt(0); const thousand = BigInt(1000)
  if (scaled <= zero || scaled > BigInt(100000000)) throw new Error(`${label} must be positive and reasonable.`)
  const remainder = scaled % thousand
  const normalized = `${scaled / thousand}${remainder !== zero ? `.${String(remainder).padStart(3, '0').replace(/0+$/, '')}` : ''}`
  return { normalized, scaled, value: Number(normalized) }
}

export function sameMeasurement(left: unknown, right: unknown) {
  try { return parseMeasurement(left).scaled === parseMeasurement(right).scaled } catch { return false }
}

export function formatDimensions(height: unknown, width: unknown, unit: string) {
  return `${parseMeasurement(height, 'Height').normalized} × ${parseMeasurement(width, 'Width').normalized} ${unit}`
}
