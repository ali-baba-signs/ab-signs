import { StaticCanvas } from 'fabric'
import type { ProductConfig } from './types'

export interface BrowserRenderAsset {
  key: string
  contentType: 'image/png'
  size: number
  pixelWidth: number
  pixelHeight: number
}

export interface BrowserSideRender {
  preview: { blob: Blob; contentType: 'image/png'; pixelWidth: number; pixelHeight: number }
}

function canvasBlob(canvas: HTMLCanvasElement, contentType: 'image/png') {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode the design preview.')), contentType)
  })
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
    const previewBlob = await canvasBlob(previewCanvas, 'image/png')
    return {
      preview: { blob: previewBlob, contentType: 'image/png', pixelWidth: previewCanvas.width, pixelHeight: previewCanvas.height },
    }
  } finally {
    canvas.dispose()
  }
}

export async function uploadBrowserRender(
  asset: BrowserSideRender['preview'],
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

export async function uploadProductionFile(
  asset: { blob: Blob; contentType: 'application/pdf' | 'image/svg+xml'; pixelWidth: number; pixelHeight: number; metadata: Record<string, unknown> },
  filename: string,
  designId: string,
) {
  const presignResponse = await fetch('/api/uploads/presign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename, contentType: asset.contentType, size: asset.blob.size, purpose: 'design-production', designId }) })
  const presignPayload = await presignResponse.json()
  if (!presignResponse.ok) throw new Error(presignPayload.error?.message || 'The production file upload could not be prepared.')
  const uploadResponse = await fetch(presignPayload.data.uploadUrl, { method: 'PUT', headers: { 'content-type': asset.contentType }, body: asset.blob })
  if (!uploadResponse.ok) throw new Error('The generated production file could not be uploaded.')
  return { key: presignPayload.data.key as string, contentType: asset.contentType, size: asset.blob.size, pixelWidth: asset.pixelWidth, pixelHeight: asset.pixelHeight, metadata: asset.metadata }
}

export const uploadProductionPdf = uploadProductionFile
