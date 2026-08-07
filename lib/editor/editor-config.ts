import type { ProductConfig } from './types'

export const DEFAULT_PRODUCT_CONFIG: ProductConfig = {
  widthMm: 1828.8,
  heightMm: 914.4,
  bleedMm: 3,
  safeMarginMm: 25,
  logicalCanvasWidth: 1200,
  logicalCanvasHeight: 600,
}

export const PRODUCT_PRESETS: Array<{ name: string; config: ProductConfig }> = [
  { name: '6 × 3 ft Vinyl Banner', config: DEFAULT_PRODUCT_CONFIG },
  {
    name: '4 × 2 ft Vinyl Banner',
    config: { ...DEFAULT_PRODUCT_CONFIG, widthMm: 1219.2, heightMm: 609.6 },
  },
  {
    name: 'A2 Poster',
    config: {
      widthMm: 594,
      heightMm: 420,
      bleedMm: 3,
      safeMarginMm: 10,
      logicalCanvasWidth: 990,
      logicalCanvasHeight: 700,
    },
  },
  {
    name: '24 × 18 in Sign',
    config: {
      widthMm: 609.6,
      heightMm: 457.2,
      bleedMm: 3,
      safeMarginMm: 12,
      logicalCanvasWidth: 1000,
      logicalCanvasHeight: 750,
    },
  },
]

export function normalizeProductConfig(config: ProductConfig): ProductConfig {
  const ratio = Math.max(0.1, config.widthMm) / Math.max(0.1, config.heightMm)
  const maxSide = 1200
  const logicalCanvasWidth = ratio >= 1 ? maxSide : Math.round(maxSide * ratio)
  const logicalCanvasHeight = ratio >= 1 ? Math.round(maxSide / ratio) : maxSide
  return { ...config, logicalCanvasWidth, logicalCanvasHeight }
}
