import 'server-only'

import { createHash } from 'node:crypto'
import { createUploadKey, UploadValidationError } from './upload-validation'
import { deleteObject, getObjectBody, getObjectMetadata, uploadObject } from './r2'
import { designRenderChunkSize, type DesignRenderUploadManifest } from './design-render-uploads'
import { sanitizeSvgMarkup } from '@/lib/templates/svg-sanitization'

function safeOwner(ownerId: string) {
  return ownerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
}

function partKey(ownerId: string, manifest: DesignRenderUploadManifest, index: number) {
  return `uploads/users/${safeOwner(ownerId)}/temporary/design-render-parts/${manifest.uploadId}-${index}.part`
}

function manifestHash(manifest: DesignRenderUploadManifest) {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
}

export async function storeDesignRenderChunk(ownerId: string, manifest: DesignRenderUploadManifest, index: number, body: Buffer) {
  if (body.length !== designRenderChunkSize(manifest, index)) throw new UploadValidationError('INVALID_UPLOAD', 'The generated artwork upload is incomplete. Please retry.')
  await uploadObject({ key: partKey(ownerId, manifest, index), body, contentType: 'application/octet-stream', metadata: { ownerId, manifest: manifestHash(manifest), temporary: 'true' } })
  return { received: index }
}

function validateGeneratedFile(contentType: string, body: Buffer) {
  if (contentType === 'image/png' && !body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new UploadValidationError('INVALID_FILE_CONTENT', 'The generated design preview is not a valid PNG.')
  if (contentType === 'application/pdf' && !body.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new UploadValidationError('INVALID_FILE_CONTENT', 'The generated production file is not a valid PDF.')
  if (contentType === 'image/svg+xml') return Buffer.from(sanitizeSvgMarkup(body.toString('utf8')), 'utf8')
  return body
}

export async function completeDesignRenderUpload(ownerId: string, manifest: DesignRenderUploadManifest) {
  const parts: Buffer[] = []
  const keys: string[] = []
  for (let index = 0, length = 0; length < manifest.size; index += 1) {
    const expectedSize = designRenderChunkSize(manifest, index)
    const key = partKey(ownerId, manifest, index)
    const metadata = await getObjectMetadata(key)
    if (metadata.ContentLength !== expectedSize || metadata.Metadata?.manifest !== manifestHash(manifest) || (metadata.Metadata?.ownerid ?? metadata.Metadata?.ownerId) !== ownerId) {
      throw new UploadValidationError('INVALID_UPLOAD', 'The generated artwork upload could not be verified. Please retry.')
    }
    const body = await getObjectBody(key)
    if (body.length !== expectedSize) throw new UploadValidationError('INVALID_UPLOAD', 'The generated artwork upload is incomplete. Please retry.')
    parts.push(body)
    keys.push(key)
    length += body.length
  }
  const source = Buffer.concat(parts)
  const body = validateGeneratedFile(manifest.contentType, source)
  const key = createUploadKey(manifest, ownerId)
  await uploadObject({ key, body, contentType: manifest.contentType, metadata: { ownerId, checksum: createHash('sha256').update(body).digest('hex'), generated: 'true' } })
  await Promise.all(keys.map((part) => deleteObject(part).catch((error) => console.error('Design render part cleanup deferred', error))))
  return { key, contentType: manifest.contentType, size: body.length }
}
