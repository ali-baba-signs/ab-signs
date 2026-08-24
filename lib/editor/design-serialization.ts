import type { Canvas } from 'fabric'
import type { ProductConfig, SavedDesign } from './types'

const STORAGE_KEY = 'alibaba-signs:design:v1'

export function serializeDesign(
  canvas: Canvas,
  productConfig: ProductConfig,
  templateId: string | null,
  sides?: SavedDesign['sides'],
): SavedDesign {
  const canvasJson = canvas.toJSON() as Record<string, unknown>
  const objectsJson = Array.isArray(canvasJson.objects)
    ? canvasJson.objects.filter((object) => {
        const role = object && typeof object === 'object' ? (object as Record<string, unknown>).role : null
        return role !== 'fixed-product-layer'
      })
    : []
  return {
    version: sides ? 2 : 1,
    productConfig,
    templateId,
    canvasJson,
    objectsJson,
    sides,
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
    return (value.version === 1 || value.version === 2) && value.canvasJson && value.productConfig ? value : null
  } catch {
    return null
  }
}
