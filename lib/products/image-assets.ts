import 'server-only'

import { inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { storageAssets } from '@/lib/db/schema'
import type { ProductImageInput } from './validation'

export async function validateNewProductImageAssets(images: ProductImageInput[]) {
  const pending = images.filter((image) => !image.id)
  const assetIds = pending.map((image) => image.assetId!).filter(Boolean)
  const assets = assetIds.length ? await db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds)) : []
  if (assets.length !== new Set(assetIds).size) throw new Error('One or more uploaded product images could not be found.')
  for (const image of pending) {
    const asset = assets.find((row) => row.id === image.assetId)
    if (!asset || asset.objectKey !== image.key || asset.status !== 'available' || !asset.objectKey.startsWith('products/') || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.contentType)) {
      throw new Error('A product image reference is invalid or is not an available PNG, JPG, or WebP upload.')
    }
  }
}
