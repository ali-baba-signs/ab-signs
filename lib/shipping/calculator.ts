export interface ShippingBand {
  maxAreaM2: number | null
  price: number
}

export interface ShippingLine {
  quantity: number
  width: number
  height: number
  unit: string
  isBanner: boolean
  freeShipping?: boolean
}

export const DEFAULT_BANNER_SHIPPING_BANDS: ShippingBand[] = [
  { maxAreaM2: 2, price: 15 },
  { maxAreaM2: 5, price: 20 },
  { maxAreaM2: 10, price: 28 },
  { maxAreaM2: 20, price: 40 },
  { maxAreaM2: null, price: 55 },
]

const METRES_PER_UNIT: Record<string, number> = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 }

export function printedAreaM2(line: ShippingLine) {
  const factor = METRES_PER_UNIT[line.unit.toLowerCase()]
  if (!factor || !(line.width > 0) || !(line.height > 0) || !(line.quantity > 0)) return 0
  return line.width * factor * line.height * factor * line.quantity
}

export function bannerShippingForArea(areaM2: number, bands: ShippingBand[] = DEFAULT_BANNER_SHIPPING_BANDS) {
  if (!(areaM2 > 0)) return 0
  const ordered = bands
    .filter((band) => band.maxAreaM2 === null || band.maxAreaM2 > 0)
    .sort((a, b) => (a.maxAreaM2 ?? Number.POSITIVE_INFINITY) - (b.maxAreaM2 ?? Number.POSITIVE_INFINITY))
  const band = ordered.find((item) => item.maxAreaM2 === null || areaM2 <= item.maxAreaM2) ?? ordered.at(-1)
  return Math.max(0, Number(band?.price) || 0)
}

export function calculateShipping(input: {
  deliveryType: 'delivery' | 'pickup'
  lines: ShippingLine[]
  productSubtotal: number
  standardShippingCost: number
  freeShippingThreshold: number
  bannerBands?: ShippingBand[]
}) {
  if (input.deliveryType === 'pickup') return { amount: 0, bannerAreaM2: 0, reason: 'pickup' as const }
  const billable = input.lines.filter((line) => !line.freeShipping)
  if (!billable.length) return { amount: 0, bannerAreaM2: 0, reason: 'product_free_shipping' as const }
  const bannerAreaM2 = billable.filter((line) => line.isBanner).reduce((sum, line) => sum + printedAreaM2(line), 0)
  const bannerAmount = bannerShippingForArea(bannerAreaM2, input.bannerBands)
  const hasStandardProducts = billable.some((line) => !line.isBanner)
  const standardAmount = hasStandardProducts && input.productSubtotal < input.freeShippingThreshold ? Math.max(0, input.standardShippingCost) : 0
  return {
    amount: Math.max(bannerAmount, standardAmount),
    bannerAreaM2: Math.round(bannerAreaM2 * 1000) / 1000,
    reason: bannerAreaM2 > 0 ? 'banner_area' as const : standardAmount > 0 ? 'standard' as const : 'threshold' as const,
  }
}
