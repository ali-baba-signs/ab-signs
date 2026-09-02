import 'server-only'

import { and, asc, eq, like, lt, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { designs, designVersions, orderItems, storageAssets } from '@/lib/db/schema'
import { deleteObject } from '@/lib/storage/r2'
import { R2_PATHS } from '@/lib/storage/r2-paths'
import { canvasSessionUploadKeys, canvasUploadFolder, cleanupCanvasUploadCandidates, collectCanvasUploadKeys } from '@/lib/storage/canvas-uploads'
import { getAssetReferences } from '@/lib/storage/asset-records'

async function referencedUploadKeys() {
  const [savedDesigns, savedVersions, savedOrderItems] = await Promise.all([
    db.select({ data: designs.canvasData }).from(designs),
    db.select({ data: designVersions.canvasData }).from(designVersions),
    db.select({ data: orderItems.specifications }).from(orderItems),
  ])
  const usedKeys = new Set<string>()
  for (const row of [...savedDesigns, ...savedVersions, ...savedOrderItems]) collectCanvasUploadKeys(row.data, usedKeys)
  return usedKeys
}

async function removeUnused(candidates: { id: string; key: string }[]) {
  if (!candidates.length) return { checked: 0, deleted: 0, preserved: 0, deletedKeys: [] as string[] }
  const usedKeys = await referencedUploadKeys()
  return cleanupCanvasUploadCandidates(candidates, {
    usedKeys,
    isReferenced: async (candidate) => (await getAssetReferences(candidate.id, candidate.key)).total > 0,
    // Re-check retained assets later, without letting them starve newer abandoned files.
    preserve: (candidate) => db.update(storageAssets).set({ updatedAt: new Date() }).where(eq(storageAssets.id, candidate.id)),
    remove: async (candidate) => {
      await deleteObject(candidate.key)
      await db.delete(storageAssets).where(eq(storageAssets.id, candidate.id))
    },
    failed: (candidate, error) => console.error('Canvas upload cleanup failed for one object', candidate.key, error),
  })
}

/** Only keys from this editor session are eligible; never sweep another active tab. */
export async function cleanupUnusedCanvasUploads(ownerId: string, sessionKeys: unknown) {
  const folder = canvasUploadFolder(ownerId)
  const keys = canvasSessionUploadKeys(ownerId, sessionKeys)
  const candidates: { id: string; key: string }[] = []
  for (const key of keys) {
    const [asset] = await db.select({ id: storageAssets.id, key: storageAssets.objectKey }).from(storageAssets)
      .where(and(eq(storageAssets.objectKey, key), eq(storageAssets.folder, folder), eq(storageAssets.access, 'private'))).limit(1)
    if (asset) candidates.push(asset)
  }
  return removeUnused(candidates)
}

export async function cleanupAbandonedCanvasUploads(input: { olderThan?: Date; limit?: number } = {}) {
  const olderThan = input.olderThan ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
  const limit = Math.min(Math.max(input.limit ?? 250, 1), 500)
  const candidates = await db.select({ id: storageAssets.id, key: storageAssets.objectKey }).from(storageAssets)
    .where(and(or(like(storageAssets.folder, `${R2_PATHS.userUploads}/%/temporary/canvas`), like(storageAssets.folder, `${R2_PATHS.userUploads}/%/temporary/canvas-parts`)), eq(storageAssets.access, 'private'), lt(storageAssets.updatedAt, olderThan)))
    .orderBy(asc(storageAssets.updatedAt)).limit(limit)
  return removeUnused(candidates)
}
