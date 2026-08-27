import type { ProductConfig } from '@/lib/editor/types'

export const FLAG_BLEED_MM = 20
export const FLAG_CUT_LINE_MM = 0
export const FLAG_SAFETY_MM = 50

export interface ProductionSpec {
  productKind: 'rectangle' | 'flag'
  trimWidthMm: number
  trimHeightMm: number
  bleedMm: number
  cutLineMm: number
  safetyMm: number
  cropMarks: boolean
  markMarginMm: number
  pageWidthMm: number
  pageHeightMm: number
}

export function productionSpec(config: ProductConfig): ProductionSpec {
  const productKind = config.productCategory === 'flag' ? 'flag' : 'rectangle'
  const trimWidthMm = Math.max(0.1, Number(config.widthMm))
  const trimHeightMm = Math.max(0.1, Number(config.heightMm))
  const bleedMm = productKind === 'flag' ? FLAG_BLEED_MM : Math.max(0, Number(config.bleedMm) || 0)
  const safetyMm = productKind === 'flag' ? FLAG_SAFETY_MM : Math.max(0, Number(config.safeMarginMm) || 0)
  const cropMarks = config.trimMarks !== false
  const markMarginMm = cropMarks ? Math.max(8, bleedMm + 5) : 0
  return {
    productKind,
    trimWidthMm,
    trimHeightMm,
    bleedMm,
    cutLineMm: FLAG_CUT_LINE_MM,
    safetyMm,
    cropMarks,
    markMarginMm,
    pageWidthMm: trimWidthMm + (bleedMm + markMarginMm) * 2,
    pageHeightMm: trimHeightMm + (bleedMm + markMarginMm) * 2,
  }
}

export function productionMetadata(config: ProductConfig) {
  const spec = productionSpec(config)
  return {
    formatVersion: 2,
    productKind: spec.productKind,
    trimWidthMm: spec.trimWidthMm,
    trimHeightMm: spec.trimHeightMm,
    bleedMm: spec.bleedMm,
    cutLineMm: spec.cutLineMm,
    safetyMm: spec.safetyMm,
    cropMarks: spec.cropMarks,
    pageWidthMm: spec.pageWidthMm,
    pageHeightMm: spec.pageHeightMm,
  }
}
