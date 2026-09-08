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
  if (String(details?.name || '') === 'AbortError') return 'The artwork upload timed out. Check your connection and retry.'
  const message = String(details?.message || '')
  if (/generated artwork|production file|design preview|sign in|storage is temporarily|maximum file size|filename extension/i.test(message)) return message
  return 'The generated artwork could not be stored. Your design is still open; check your connection and retry.'
}
