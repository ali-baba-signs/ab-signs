import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/require-admin'
import { createUploadKey, UploadValidationError, validateUpload } from '@/lib/storage/upload-validation'
import { deleteObject, R2ConfigurationError, uploadObject } from '@/lib/storage/r2'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'
import type { UploadPurpose } from '@/lib/storage/r2-paths'
import { db } from '@/lib/db/client'
import { adminActivityLogs, storageAssets } from '@/lib/db/schema'
import { activityValues } from '@/lib/admin/activity'
import { registerStorageAsset } from '@/lib/storage/asset-records'
import { eq } from 'drizzle-orm'
import { sanitizeSvgMarkup, SvgValidationError } from '@/lib/templates/svg-sanitization'
import { createHash } from 'node:crypto'
import { deleteAssetIfOrphaned, findStorageAsset, getAssetReferences } from '@/lib/storage/asset-records'

const purposes = new Set<UploadPurpose>(['product-image', 'template', 'homepage', 'offer-image', 'order-document'])

function inferredType(file: File) {
  if (file.type) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension === 'json' ? 'application/json' : extension === 'svg' ? 'image/svg+xml' : extension === 'pdf' ? 'application/pdf' : extension === 'webm' ? 'video/webm' : ''
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const form = await request.formData()
    const file = form.get('file')
    const purpose = form.get('purpose') as UploadPurpose
    const destination = String(form.get('destination') || '')
    if (!(file instanceof File) || !purposes.has(purpose)) {
      return NextResponse.json({ error: { code: 'INVALID_UPLOAD', message: 'A file and valid upload purpose are required.' } }, { status: 400 })
    }
    const contentType = inferredType(file)
    const requestData = { filename: file.name, contentType, size: file.size, purpose, destination }
    validateUpload(requestData)
    const key = createUploadKey(requestData, session.user.id)
    const source = Buffer.from(await file.arrayBuffer())
    const body = contentType === 'image/svg+xml' ? Buffer.from(sanitizeSvgMarkup(source.toString('utf8')), 'utf8') : source
    const checksum = createHash('sha256').update(body).digest('hex')
    await uploadObject({ key, body, contentType, metadata: { uploadedBy: session.user.id, originalName: file.name.slice(0, 250), checksum, ...(contentType === 'image/svg+xml' ? { svgValidated: 'true' } : {}) } })
    let asset
    try {
      asset = await registerStorageAsset({ key, contentType, size: body.length, uploadedBy: session.user.id, etag: checksum })
      await db.insert(adminActivityLogs).values(activityValues(session, { actionType: 'asset.uploaded', entityType: 'storage_asset', entityId: key, entityName: file.name, description: `Uploaded ${file.name} to storage.`, metadata: { key, purpose, contentType, size: file.size } }))
    } catch (error) {
      await deleteObject(key).catch(() => undefined)
      await db.delete(storageAssets).where(eq(storageAssets.objectKey, key)).catch(() => undefined)
      throw error
    }
    return NextResponse.json({ data: { id: asset.id, key, url: getStoredAssetUrl(key), filename: file.name, contentType, size: body.length, checksum } }, { status: 201 })
  } catch (error) {
    if (error instanceof UploadValidationError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 })
    if (error instanceof SvgValidationError) return NextResponse.json({ error: { code: 'UNSAFE_SVG', message: error.message } }, { status: 400 })
    if (error instanceof R2ConfigurationError || (error instanceof Error && error.message.includes('NEXT_PUBLIC_R2'))) {
      return NextResponse.json({ error: { code: 'STORAGE_NOT_CONFIGURED', message: 'R2 storage is incomplete. Configure the bucket credentials and public base URL.' } }, { status: 503 })
    }
    if (error instanceof Error && /unauthorized|access.?denied|invalid.?access.?key|signature/i.test(`${error.name} ${error.message}`)) {
      return NextResponse.json({ error: { code: 'STORAGE_AUTH_FAILED', message: 'R2 rejected the configured credentials. Verify the account ID, bucket, access key permissions, and secret key.' } }, { status: 503 })
    }
    console.error('Admin upload failed', error)
    return NextResponse.json({ error: { code: 'UPLOAD_FAILED', message: 'The file could not be uploaded. Check storage permissions and try again.' } }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const { key } = await request.json() as { key?: string }
    if (!key || !/^(products|design-editor\/templates|homepage|offers|orders)\//.test(key)) {
      return NextResponse.json({ error: { code: 'INVALID_KEY', message: 'This storage object cannot be removed.' } }, { status: 400 })
    }
    const asset = await findStorageAsset(key)
    if (!asset) return NextResponse.json({ error: { code: 'ASSET_NOT_FOUND', message: 'The uploaded asset record was not found.' } }, { status: 404 })
    const references = await getAssetReferences(asset.id, key)
    if (references.total) return NextResponse.json({ error: { code: 'ASSET_IN_USE', message: 'This upload is already in use and cannot be removed.' } }, { status: 409 })
    await deleteAssetIfOrphaned(key)
    await db.insert(adminActivityLogs).values(activityValues(session, { actionType: 'asset.deleted', entityType: 'storage_asset', entityId: key, entityName: key.split('/').pop(), description: `Removed uploaded asset ${key}.`, metadata: { key } }))
    return NextResponse.json({ data: { deleted: key } })
  } catch (error) {
    console.error('Admin upload cleanup failed', error)
    return NextResponse.json({ error: { code: 'DELETE_FAILED', message: 'The uploaded object could not be removed.' } }, { status: 500 })
  }
}
