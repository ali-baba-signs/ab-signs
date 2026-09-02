import { CANVAS_IMAGE_UPLOAD_ERROR, UploadValidationError, validateUpload } from './upload-validation'

export const CANVAS_UPLOAD_PREFIX = 'uploads/users/'
export const CANVAS_UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024
const SVG_UPLOAD_ERROR = 'This SVG cannot be used safely. Export it as a self-contained SVG or upload PNG instead.'

export function canvasUploadFolder(ownerId: string) {
  const owner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
  return `${CANVAS_UPLOAD_PREFIX}${owner}/temporary/canvas`
}

export type CanvasUploadManifest = { uploadId: string; filename: string; contentType: string; size: number }

export function validateCanvasUploadManifest(value: unknown): CanvasUploadManifest {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  if (typeof input.uploadId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.uploadId)
    || typeof input.filename !== 'string' || input.filename.length > 255 || typeof input.contentType !== 'string'
    || typeof input.size !== 'number' || !Number.isInteger(input.size)) {
    throw new UploadValidationError('INVALID_UPLOAD', 'Upload failed. Try again.')
  }
  const manifest = { uploadId: input.uploadId, filename: input.filename, contentType: input.contentType, size: input.size }
  validateUpload({ ...manifest, purpose: 'logo' })
  return manifest
}

export function canvasUploadChunkSize(manifest: CanvasUploadManifest, index: number) {
  const count = Math.ceil(manifest.size / CANVAS_UPLOAD_CHUNK_BYTES)
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new UploadValidationError('INVALID_UPLOAD', 'Upload failed. Try again.')
  return Math.min(CANVAS_UPLOAD_CHUNK_BYTES, manifest.size - index * CANVAS_UPLOAD_CHUNK_BYTES)
}

export function canvasSessionUploadKeys(ownerId: string, sessionKeys: unknown) {
  const prefix = `${canvasUploadFolder(ownerId)}/`
  return Array.isArray(sessionKeys) ? [...new Set(sessionKeys.filter((key): key is string =>
    typeof key === 'string' && key.startsWith(prefix) && !key.slice(prefix.length).includes('/'),
  ))].slice(0, 50) : []
}

type UploadCandidate = { id: string; key: string }

/** Storage adapters keep cleanup policy testable without deleting real customer files. */
export async function cleanupCanvasUploadCandidates(candidates: UploadCandidate[], actions: {
  usedKeys: Set<string>
  isReferenced: (candidate: UploadCandidate) => Promise<boolean>
  preserve: (candidate: UploadCandidate) => Promise<unknown>
  remove: (candidate: UploadCandidate) => Promise<unknown>
  failed: (candidate: UploadCandidate, error: unknown) => void
}) {
  const deletedKeys: string[] = []
  let preserved = 0
  for (const candidate of candidates) {
    try {
      if (actions.usedKeys.has(candidate.key) || await actions.isReferenced(candidate)) {
        preserved += 1
        await actions.preserve(candidate)
      } else {
        await actions.remove(candidate)
        deletedKeys.push(candidate.key)
      }
    } catch (error) { actions.failed(candidate, error) }
  }
  return { checked: candidates.length, deleted: deletedKeys.length, preserved, deletedKeys }
}

export function validateCanvasImageSignature(contentType: string, body: Uint8Array) {
  const matches = (offset: number, bytes: number[]) => bytes.every((value, index) => body[offset + index] === value)
  const valid = contentType === 'image/png' ? matches(0, [137, 80, 78, 71, 13, 10, 26, 10])
    : contentType === 'image/jpeg' ? matches(0, [255, 216, 255])
      : contentType === 'image/webp' ? matches(0, [82, 73, 70, 70]) && matches(8, [87, 69, 66, 80])
        : contentType === 'image/svg+xml' // SVG markup is checked by sanitizeSvgMarkup instead.
  if (!valid) throw new UploadValidationError('INVALID_FILE_CONTENT', CANVAS_IMAGE_UPLOAD_ERROR)
}

export function canvasUploadFingerprint(file: { name: string; size: number; type: string; lastModified?: number }) {
  return `${file.name.toLowerCase()}:${file.size}:${file.type.toLowerCase()}:${file.lastModified ?? 0}`
}

export function collectCanvasUploadKeys(value: unknown, keys = new Set<string>()) {
  if (!value || typeof value !== 'object') return keys
  if (Array.isArray(value)) {
    for (const item of value) collectCanvasUploadKeys(item, keys)
    return keys
  }

  for (const [property, item] of Object.entries(value as Record<string, unknown>)) {
    if (property === 'assetKey' && typeof item === 'string' && item.startsWith(CANVAS_UPLOAD_PREFIX)) keys.add(item)
    else collectCanvasUploadKeys(item, keys)
  }
  return keys
}

export function friendlyCanvasUploadError(error: unknown) {
  const details = error as { name?: unknown; message?: unknown }
  if (String(details?.name || '') === 'AbortError') return 'Upload timed out. Try again.'
  const message = String(details?.message || '')
  if (message === SVG_UPLOAD_ERROR) return message
  if (/^Unsupported file type\.|^File size exceeds|^Sign in|^Artwork storage is temporarily unavailable\./i.test(message)) return message
  if (/^SVG |^The file is not a complete SVG|^Imported SVG/i.test(message)) return SVG_UPLOAD_ERROR
  return 'Upload failed. Try again.'
}
