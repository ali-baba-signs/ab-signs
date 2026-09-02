import 'server-only'

import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { storageAssets } from '@/lib/db/schema'
import { registerStorageAsset } from './asset-records'
import { canvasUploadChunkSize, canvasUploadFolder, type CanvasUploadManifest, validateCanvasImageSignature } from './canvas-uploads'
import { deleteObject, getObjectBody, getObjectMetadata, uploadObject } from './r2'
import { sanitizeFilename, UploadValidationError, validateUpload } from './upload-validation'
import { sanitizeSvgMarkup } from '@/lib/templates/svg-sanitization'

async function removeTemporaryObject(key: string) {
  await deleteObject(key)
  await db.delete(storageAssets).where(eq(storageAssets.objectKey, key))
}

async function storeTemporaryObject(key: string, body: Buffer, contentType: string, metadata: Record<string, string>) {
  const checksum = createHash('sha256').update(body).digest('hex')
  try {
    await uploadObject({ key, body, contentType, metadata: { ...metadata, checksum, temporary: 'true' } })
    return await registerStorageAsset({ key, contentType, size: body.length, etag: checksum })
  } catch (error) {
    await removeTemporaryObject(key).catch((cleanupError) => console.error('Failed canvas upload rollback deferred', cleanupError))
    throw error
  }
}

export async function storeCanvasImage(ownerId: string, file: { filename: string; contentType: string; size: number }, source: Buffer) {
  validateUpload({ ...file, purpose: 'logo' })
  if (source.length !== file.size) throw new UploadValidationError('INVALID_UPLOAD', 'Upload failed. Try again.')
  validateCanvasImageSignature(file.contentType, source)
  const body = file.contentType === 'image/svg+xml' ? Buffer.from(sanitizeSvgMarkup(source.toString('utf8')), 'utf8') : source
  const key = `${canvasUploadFolder(ownerId)}/${crypto.randomUUID()}-${sanitizeFilename(file.filename)}`
  const asset = await storeTemporaryObject(key, body, file.contentType, { ownerId, originalName: encodeURIComponent(file.filename.slice(0, 250)) })
  return { id: asset.id, key, filename: file.filename, contentType: file.contentType, size: body.length }
}

function chunkKey(ownerId: string, manifest: CanvasUploadManifest, index: number) {
  return `${canvasUploadFolder(ownerId)}-parts/${manifest.uploadId}-${index}.part`
}

function manifestHash(manifest: CanvasUploadManifest) {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
}

export async function storeCanvasImageChunk(ownerId: string, manifest: CanvasUploadManifest, index: number, body: Buffer) {
  if (body.length !== canvasUploadChunkSize(manifest, index)) throw new UploadValidationError('INVALID_UPLOAD', 'Upload failed. Try again.')
  await storeTemporaryObject(chunkKey(ownerId, manifest, index), body, 'application/octet-stream', { ownerId, manifest: manifestHash(manifest) })
  return { received: index }
}

export async function completeCanvasImageUpload(ownerId: string, manifest: CanvasUploadManifest) {
  const parts: Buffer[] = []
  const keys: string[] = []
  // No caller-supplied storage keys or URLs are accepted. Ownership is part of every key.
  for (let index = 0, length = 0; length < manifest.size; index += 1) {
    const expectedSize = canvasUploadChunkSize(manifest, index)
    const key = chunkKey(ownerId, manifest, index)
    const metadata = await getObjectMetadata(key)
    if (metadata.ContentLength !== expectedSize || metadata.Metadata?.manifest !== manifestHash(manifest)) {
      throw new UploadValidationError('INVALID_UPLOAD', 'Upload failed. Try again.')
    }
    const body = await getObjectBody(key)
    if (body.length !== expectedSize) throw new UploadValidationError('INVALID_UPLOAD', 'Upload failed. Try again.')
    parts.push(body)
    keys.push(key)
    length += body.length
  }
  const asset = await storeCanvasImage(ownerId, manifest, Buffer.concat(parts))
  await Promise.all(keys.map((key) => removeTemporaryObject(key).catch((error) => console.error('Canvas upload part cleanup deferred', error))))
  return asset
}
