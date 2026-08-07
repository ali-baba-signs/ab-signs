import type { Canvas } from 'fabric'
import type { ProductConfig, SavedDesign } from './types'

const STORAGE_KEY = 'alibaba-signs:design:v1'

export function serializeDesign(
  canvas: Canvas,
  productConfig: ProductConfig,
  templateId: string | null,
): SavedDesign {
  return {
    version: 1,
    productConfig,
    templateId,
    canvasJson: canvas.toJSON(),
    updatedAt: new Date().toISOString(),
  }
}

export function saveDesign(design: SavedDesign) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(design))
}

export function loadDesign(): SavedDesign | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as SavedDesign
    return value.version === 1 && value.canvasJson && value.productConfig ? value : null
  } catch {
    return null
  }
}
