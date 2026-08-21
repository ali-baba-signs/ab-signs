import { StaticCanvas } from 'fabric'
import type { ProductConfig } from './types'

export interface BrowserRenderAsset {
  key: string
  contentType: 'image/png' | 'image/jpeg'
  size: number
  pixelWidth: number
  pixelHeight: number
}

export interface BrowserSideRender {
  preview: { blob: Blob; contentType: 'image/png'; pixelWidth: number; pixelHeight: number }
  production: { blob: Blob; contentType: 'image/jpeg'; pixelWidth: number; pixelHeight: number }
}

function canvasBlob(canvas: HTMLCanvasElement, contentType: 'image/png' | 'image/jpeg', quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode the design preview.')), contentType, quality)
  })
}

function opaqueCopy(source: HTMLCanvasElement) {
  const output = document.createElement('canvas')
  output.width = source.width
  output.height = source.height
  const context = output.getContext('2d')
  if (!context) throw new Error('The browser could not prepare the production preview.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, output.width, output.height)
  context.drawImage(source, 0, 0)
  return output
}

/** Renders serialized Fabric state without changing the visible editor canvas. */
export async function renderBrowserSide(
  canvasJson: Record<string, unknown>,
  productConfig: ProductConfig,
): Promise<BrowserSideRender> {
  const width = Math.max(100, Math.round(productConfig.logicalCanvasWidth))
  const height = Math.max(100, Math.round(productConfig.logicalCanvasHeight))
  const element = document.createElement('canvas')
  const canvas = new StaticCanvas(element, { width, height, backgroundColor: '#ffffff', renderOnAddRemove: false })
  try {
    await canvas.loadFromJSON(canvasJson)
    canvas.renderAll()
    const filter = (object: { excludeFromExport?: boolean }) => !object.excludeFromExport
    const maxDimension = Math.max(width, height)
    const previewCanvas = canvas.toCanvasElement(Math.min(2, 3200 / maxDimension), { filter })
    const productionCanvas = canvas.toCanvasElement(Math.min(5, 6500 / maxDimension), { filter })
    const productionOpaque = opaqueCopy(productionCanvas)
    const [previewBlob, productionBlob] = await Promise.all([
      canvasBlob(previewCanvas, 'image/png'),
      canvasBlob(productionOpaque, 'image/jpeg', 0.94),
    ])
    return {
      preview: { blob: previewBlob, contentType: 'image/png', pixelWidth: previewCanvas.width, pixelHeight: previewCanvas.height },
      production: { blob: productionBlob, contentType: 'image/jpeg', pixelWidth: productionOpaque.width, pixelHeight: productionOpaque.height },
    }
  } finally {
    canvas.dispose()
  }
}

export async function uploadBrowserRender(
  asset: BrowserSideRender['preview'] | BrowserSideRender['production'],
  filename: string,
  designId: string,
): Promise<BrowserRenderAsset> {
  const presignResponse = await fetch('/api/uploads/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename, contentType: asset.contentType, size: asset.blob.size, purpose: 'design-preview', designId }),
  })
  const presignPayload = await presignResponse.json()
  if (!presignResponse.ok) throw new Error(presignPayload.error?.message || 'The design preview upload could not be prepared.')
  const uploadResponse = await fetch(presignPayload.data.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': asset.contentType },
    body: asset.blob,
  })
  if (!uploadResponse.ok) throw new Error('The generated design preview could not be uploaded.')
  return {
    key: presignPayload.data.key,
    contentType: asset.contentType,
    size: asset.blob.size,
    pixelWidth: asset.pixelWidth,
    pixelHeight: asset.pixelHeight,
  }
}
