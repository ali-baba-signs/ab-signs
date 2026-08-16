import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { homepagePromotions, storageAssets } from '@/lib/db/schema'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'

export async function getHomepagePromotions(enabledOnly = true) {
  const rows = await db.select({ promotion: homepagePromotions, asset: storageAssets }).from(homepagePromotions).leftJoin(storageAssets, eq(homepagePromotions.imageAssetId, storageAssets.id)).where(enabledOnly ? eq(homepagePromotions.enabled, true) : undefined).orderBy(asc(homepagePromotions.displayOrder), asc(homepagePromotions.createdAt))
  return rows.map(({ promotion, asset }) => ({ ...promotion, image: asset ? getStoredAssetUrl(asset.objectKey) : promotion.imageUrl || '' }))
}
