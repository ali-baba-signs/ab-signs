import { UploadValidationError, validateUpload } from './upload-validation'

export const DESIGN_RENDER_CHUNK_BYTES = 2 * 1024 * 1024
export type DesignRenderPurpose = 'design-preview' | 'design-production'

export type DesignRenderUploadManifest = {
  uploadId: string
  filename: string
  contentType: string
  size: number
  purpose: DesignRenderPurpose
  designId: string
}

export function validateDesignRenderManifest(value: unknown): DesignRenderUploadManifest {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  if (typeof input.uploadId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.uploadId)
    || typeof input.filename !== 'string' || input.filename.length > 255
    || typeof input.contentType !== 'string'
    || typeof input.size !== 'number' || !Number.isInteger(input.size)
    || (input.purpose !== 'design-preview' && input.purpose !== 'design-production')
    || typeof input.designId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.designId)) {
    throw new UploadValidationError('INVALID_UPLOAD', 'The generated artwork upload is invalid. Render the design again and retry.')
  }
  const manifest = input as DesignRenderUploadManifest
  validateUpload(manifest)
  return manifest
}

export function designRenderChunkSize(manifest: DesignRenderUploadManifest, index: number) {
  const count = Math.ceil(manifest.size / DESIGN_RENDER_CHUNK_BYTES)
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new UploadValidationError('INVALID_UPLOAD', 'The generated artwork upload is incomplete. Please retry.')
  }
  return Math.min(DESIGN_RENDER_CHUNK_BYTES, manifest.size - index * DESIGN_RENDER_CHUNK_BYTES)
}

export function friendlyDesignRenderError(error: unknown) {
  const details = error as { name?: unknown; message?: unknown }
  const name = String(details?.name || '')
  if (name === 'AbortError') return 'The artwork upload timed out before the server responded. Your design is still open; retry.'
  const message = String(details?.message || '')
  if (/SVG root|SVG closing tag|complete SVG document|SVG document types|SVG contains|Imported SVG/i.test(message)) return 'Your design preview could not be generated. Please retry.'
  if (/generated artwork|production file|design preview|sign in|storage is temporarily|maximum file size|filename extension/i.test(message)) return message
  if (name === 'TypeError' || /failed to fetch|network|load failed/i.test(message)) return 'A network connection to the design upload service could not be made. Your design is still open; retry when the service is reachable.'
  const detail = message.replace(/[\r\n]+/g, ' ').trim().slice(0, 160)
  return `The artwork upload stopped before storage responded.${detail ? ` Browser detail: ${detail}.` : ''} Your design is still open; retry.`
}
