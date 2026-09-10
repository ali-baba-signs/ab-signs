import { StaticCanvas } from 'fabric'
import type { ProductConfig } from './types'
import { DESIGN_RENDER_CHUNK_BYTES, friendlyDesignRenderError, type DesignRenderPurpose, type DesignRenderUploadManifest } from '@/lib/storage/design-render-uploads'
import { ensureCompleteGeneratedSvg, prepareCanvasJsonForExport } from './svg-export'

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
    await canvas.loadFromJSON(await prepareCanvasJsonForExport(canvasJson))
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
  const uploaded = await uploadGeneratedDesignAsset(asset.blob, filename, asset.contentType, 'design-preview', designId)
  return {
    key: uploaded.key,
    contentType: asset.contentType,
    size: uploaded.size,
    pixelWidth: asset.pixelWidth,
    pixelHeight: asset.pixelHeight,
  }
}

export async function uploadProductionFile(
  asset: { blob: Blob; contentType: 'application/pdf' | 'image/svg+xml'; pixelWidth: number; pixelHeight: number; metadata: Record<string, unknown> },
  filename: string,
  designId: string,
) {
  const uploaded = await uploadGeneratedDesignAsset(asset.blob, filename, asset.contentType, 'design-production', designId)
  return { key: uploaded.key, contentType: asset.contentType, size: uploaded.size, pixelWidth: asset.pixelWidth, pixelHeight: asset.pixelHeight, metadata: asset.metadata }
}

async function responsePayload(response: Response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) as { data?: Record<string, unknown>; error?: { message?: string } } }
  catch { return null }
}

export async function uploadGeneratedDesignAsset(
  blob: Blob,
  filename: string,
  contentType: string,
  purpose: DesignRenderPurpose,
  designId: string,
  fetcher: typeof fetch = fetch,
) {
  if (contentType === 'image/svg+xml') {
    try {
      ensureCompleteGeneratedSvg(await blob.text(), '1', '1')
    } catch (error) {
      console.error('Generated SVG rejected before upload', error)
      throw new Error('Your design preview could not be generated. Please retry.', { cause: error })
    }
  }
  const manifest: DesignRenderUploadManifest = { uploadId: crypto.randomUUID(), filename, contentType, size: blob.size, purpose, designId }
  const send = async (body: FormData | string) => {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), 60_000)
    try {
      const response = await fetcher('/api/uploads/design-render', {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: { 'x-design-render-upload': '1', ...(typeof body === 'string' ? { 'content-type': 'application/json' } : {}) },
        body,
      })
      const payload = await responsePayload(response)
      if (!response.ok) throw new Error(payload?.error?.message || `Design storage returned HTTP ${response.status}. Please retry.`)
      return payload?.data
    } catch (error) {
      if (error instanceof Error && !/^Failed to fetch$/i.test(error.message) && error.name !== 'TypeError') throw error
      throw new Error(friendlyDesignRenderError(error), { cause: error })
    } finally { globalThis.clearTimeout(timeout) }
  }
  for (let offset = 0, index = 0; offset < blob.size; offset += DESIGN_RENDER_CHUNK_BYTES, index += 1) {
    const form = new FormData()
    form.set('manifest', JSON.stringify(manifest))
    form.set('index', String(index))
    form.set('file', blob.slice(offset, offset + DESIGN_RENDER_CHUNK_BYTES), 'chunk.part')
    const part = await send(form)
    if (part?.received !== index) throw new Error('The generated artwork upload was interrupted. Please retry.')
  }
  const completed = await send(JSON.stringify({ manifest }))
  if (typeof completed?.key !== 'string' || !completed.key || typeof completed.size !== 'number') throw new Error('Design storage returned an incomplete response. Please retry.')
  return { key: completed.key, size: completed.size }
}

export const uploadProductionPdf = uploadProductionFile
