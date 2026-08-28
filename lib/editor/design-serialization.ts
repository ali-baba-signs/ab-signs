import type { Canvas } from 'fabric'
import type { ProductConfig, SavedDesign } from './types'

const STORAGE_KEY = 'alibaba-signs:design:v1'

function withoutVisualGuideObjects(canvasJson: Record<string, unknown>) {
  const objects = Array.isArray(canvasJson.objects) ? canvasJson.objects.filter((object) => {
    const role = object && typeof object === 'object' ? String((object as Record<string, unknown>).role || '') : ''
    return !role.startsWith('editor-guide-') && !role.startsWith('production-guide-')
  }) : canvasJson.objects
  return { ...canvasJson, objects }
}

export function serializeDesign(
  canvas: Canvas,
  productConfig: ProductConfig,
  templateId: string | null,
  sides?: SavedDesign['sides'],
  sideTemplateIds?: { front: string | null; back?: string | null },
): SavedDesign {
  const canvasJson = withoutVisualGuideObjects(canvas.toJSON() as Record<string, unknown>)
  const objectsJson = Array.isArray(canvasJson.objects)
    ? canvasJson.objects.filter((object) => {
        const role = object && typeof object === 'object' ? (object as Record<string, unknown>).role : null
        return role !== 'fixed-product-layer'
      })
    : []
  return {
    version: 3,
    sizeId: productConfig.selectedSizeId,
    designType: sides?.back ? 'double_side' : 'single_side',
    designMode: sides?.back ? 'double_side' : 'single_side',
    productConfig,
    templateId,
    canvasJson,
    objectsJson,
    sides: sides ? {
      front: { canvasJson: withoutVisualGuideObjects(sides.front.canvasJson) },
      ...(sides.back ? { back: { canvasJson: withoutVisualGuideObjects(sides.back.canvasJson) } } : {}),
    } : undefined,
    front: { templateId: sideTemplateIds?.front ?? templateId, canvasJson: sides ? withoutVisualGuideObjects(sides.front.canvasJson) : canvasJson },
    ...(sides?.back ? { back: { templateId: sideTemplateIds?.back ?? null, canvasJson: withoutVisualGuideObjects(sides.back.canvasJson) } } : {}),
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
    return (value.version === 1 || value.version === 2 || value.version === 3) && value.canvasJson && value.productConfig ? value : null
  } catch {
    return null
  }
}
