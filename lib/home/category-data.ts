import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { productCategories, storageAssets } from '@/lib/db/schema'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'

export async function getHomepageCategories() {
  const rows = await db.select({ category: productCategories, asset: storageAssets }).from(productCategories).leftJoin(storageAssets, eq(productCategories.imageAssetId, storageAssets.id)).where(and(eq(productCategories.enabled, true), eq(productCategories.showOnHomepage, true))).orderBy(asc(productCategories.displayOrder), asc(productCategories.name))
  return rows.flatMap(({ category, asset }) => asset?.status === 'available' ? [{ id: category.id, name: category.name, description: category.description || '', href: `/products?category=${encodeURIComponent(category.slug)}`, image: getStoredAssetUrl(asset.objectKey) }] : [])
}
