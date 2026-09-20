export interface ShippingBand {
  minAreaM2?: number
  maxAreaM2: number | null
  price: number
}

export const DEFAULT_BANNER_SHIPPING_BANDS: ShippingBand[] = [
  { minAreaM2: 0, maxAreaM2: 2, price: 15 },
  { minAreaM2: 2, maxAreaM2: 5, price: 20 },
  { minAreaM2: 5, maxAreaM2: 10, price: 28 },
  { minAreaM2: 10, maxAreaM2: 20, price: 40 },
  { minAreaM2: 20, maxAreaM2: null, price: 55 },
]

export function validateShippingBands(value: unknown): ShippingBand[] {
  if (!Array.isArray(value) || !value.length || value.length > 10) throw new Error('Shipping tiers require between 1 and 10 rows.')
  let previousMax = 0
  return value.map((item, index) => {
    const row = item as Partial<ShippingBand> | null
    if (!row || typeof row !== 'object') throw new Error('Invalid shipping tier.')
    const min = row.minAreaM2 === undefined ? previousMax : Number(row.minAreaM2)
    const max = row.maxAreaM2 === null || String(row.maxAreaM2) === '' ? null : Number(row.maxAreaM2)
    const price = Number(row.price)
    if (!Number.isFinite(min) || min < 0 || min !== previousMax) throw new Error('Shipping tier minimum must match the previous maximum; the first minimum must be 0.')
    if (max !== null && (!Number.isFinite(max) || max <= min || max > 100000)) throw new Error('Shipping tier maximum must be greater than its minimum.')
    if ((max === null) !== (index === value.length - 1)) throw new Error('Only the final shipping tier must have no maximum.')
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error('Shipping fee must be between 0 and 100000.')
    previousMax = max ?? min
    return { minAreaM2: min, maxAreaM2: max, price: Math.round(price * 100) / 100 }
  })
}

