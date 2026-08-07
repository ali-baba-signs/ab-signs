import 'server-only'

import { eq, inArray, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { customerArtworks, designs, heroSlides, orders, productCategories, productImages, storageAssets, templates } from '@/lib/db/schema'
import { createPresignedDownloadUrl, deleteObject, getObjectMetadata, listObjects } from './r2'
import { getStoredAssetUrl } from './r2-public-url'

const publicRoots = ['homepage/', 'products/', 'design-editor/', 'site/']

function folderOf(key: string) {
  const end = key.lastIndexOf('/')
  return end > -1 ? key.slice(0, end) : ''
}

function filenameOf(key: string) {
  return decodeURIComponent(key.split('/').pop() || key).slice(0, 255)
}

export function inferContentType(key: string) {
  const extension = key.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    svg: 'image/svg+xml', json: 'application/json', pdf: 'application/pdf',
  }
  return types[extension || ''] || 'application/octet-stream'
}

export function isPublicAssetKey(key: string) {
  return publicRoots.some((root) => key.startsWith(root))
}

export async function registerStorageAsset(input: {
  key: string
  contentType: string
  size: number
  uploadedBy?: string | null
  uploadedAt?: Date
  etag?: string | null
}) {
  const now = new Date()
  const [asset] = await db.insert(storageAssets).values({
    objectKey: input.key,
    filename: filenameOf(input.key),
    folder: folderOf(input.key),
    contentType: input.contentType,
    size: input.size,
    etag: input.etag ?? null,
    access: isPublicAssetKey(input.key) ? 'public' : 'private',
    status: 'available',
    uploadedBy: input.uploadedBy ?? null,
    uploadedAt: input.uploadedAt ?? now,
    lastSeenAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: storageAssets.objectKey,
    set: {
      filename: filenameOf(input.key), folder: folderOf(input.key), contentType: input.contentType,
      size: input.size, access: isPublicAssetKey(input.key) ? 'public' : 'private', status: 'available',
      ...(input.etag ? { etag: input.etag } : {}),
      lastSeenAt: now, updatedAt: now,
    },
  }).returning()
  return asset
}

export async function listAndReconcileAssets(input: {
  prefix: string
  limit?: number
  continuationToken?: string
}) {
  const page = await listObjects({ prefix: input.prefix, maxKeys: input.limit, continuationToken: input.continuationToken })
  const keys = page.objects.map((object) => object.key).filter(Boolean)
  const existing = keys.length
    ? await db.select().from(storageAssets).where(inArray(storageAssets.objectKey, keys))
    : []
  const byKey = new Map(existing.map((asset) => [asset.objectKey, asset]))

  for (const object of page.objects) {
    if (!object.key) continue
    const known = byKey.get(object.key)
    let contentType = known?.contentType || inferContentType(object.key)
    let uploadedAt = object.updatedAt ? new Date(object.updatedAt) : new Date()
    let status = 'available'
    if (!known) {
      try {
        const metadata = await getObjectMetadata(object.key)
        contentType = metadata.ContentType || contentType
        uploadedAt = metadata.LastModified || uploadedAt
      } catch {
        status = 'inaccessible'
      }
    }
    const asset = await registerStorageAsset({ key: object.key, contentType, size: object.size, uploadedAt })
    if (status !== 'available') {
      await db.update(storageAssets).set({ status, updatedAt: new Date() }).where(eq(storageAssets.id, asset.id))
      asset.status = status
    }
    byKey.set(object.key, asset)
  }

  const objects = await Promise.all(page.objects.map(async (object) => {
    const asset = byKey.get(object.key)
    if (!asset) return null
    const previewUrl = await createPresignedDownloadUrl(object.key)
    return {
      id: asset.id,
      key: object.key,
      filename: asset.filename,
      folder: asset.folder,
      contentType: asset.contentType,
      size: object.size,
      updatedAt: object.updatedAt,
      status: asset.status,
      previewUrl,
      publicUrl: asset.access === 'public' ? getStoredAssetUrl(object.key) : null,
    }
  }))

  return {
    objects: objects.filter(Boolean),
    nextContinuationToken: page.nextContinuationToken,
    isTruncated: page.isTruncated,
  }
}

export async function getAssetReferences(assetId: string, key: string) {
  const [images, templateRows, heroes, artworks, designRows, categories, orderDocuments] = await Promise.all([
    db.select({ id: productImages.id }).from(productImages).where(or(eq(productImages.assetId, assetId), eq(productImages.storageKey, key))),
    db.select({ id: templates.id }).from(templates).where(or(
      eq(templates.previewAssetId, assetId), eq(templates.svgAssetId, assetId),
      eq(templates.previewImageKey, key), eq(templates.svgKey, key), eq(templates.jsonKey, key),
    )),
    db.select({ id: heroSlides.id }).from(heroSlides).where(or(eq(heroSlides.desktopAssetId, assetId), eq(heroSlides.mobileAssetId, assetId))),
    db.select({ id: customerArtworks.id }).from(customerArtworks).where(eq(customerArtworks.assetId, assetId)),
    db.select({ id: designs.id }).from(designs).where(eq(designs.assetId, assetId)),
    db.select({ id: productCategories.id }).from(productCategories).where(eq(productCategories.imageAssetId, assetId)),
    db.select({ id: orders.id }).from(orders).where(eq(orders.receiptAssetId, assetId)),
  ])
  return { products: images.length, templates: templateRows.length, heroes: heroes.length, artworks: artworks.length, designs: designRows.length, categories: categories.length, orderDocuments: orderDocuments.length, total: images.length + templateRows.length + heroes.length + artworks.length + designRows.length + categories.length + orderDocuments.length }
}

export async function findStorageAsset(key: string) {
  const [asset] = await db.select().from(storageAssets).where(eq(storageAssets.objectKey, key)).limit(1)
  return asset ?? null
}

export async function deleteAssetIfOrphaned(key: string) {
  const asset = await findStorageAsset(key)
  if (!asset) return { deleted: false, reason: 'unregistered' as const }
  const references = await getAssetReferences(asset.id, key)
  if (references.total) return { deleted: false, reason: 'in-use' as const, references }
  await deleteObject(key)
  await db.delete(storageAssets).where(eq(storageAssets.id, asset.id))
  return { deleted: true, reason: 'orphaned' as const }
}
