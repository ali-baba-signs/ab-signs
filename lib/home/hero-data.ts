import 'server-only'

import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { heroSlides, storageAssets } from '@/lib/db/schema'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'

export async function getHeroSlides(activeOnly = false) {
  const rows = await db.select().from(heroSlides).where(activeOnly ? eq(heroSlides.enabled, true) : undefined).orderBy(asc(heroSlides.displayOrder), asc(heroSlides.createdAt))
  const assetIds = [...new Set(rows.flatMap((slide) => [slide.desktopAssetId, slide.mobileAssetId].filter((id): id is string => Boolean(id))))]
  const assets = assetIds.length ? await db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds)) : []
  return rows.map((slide) => {
    const desktop = assets.find((asset) => asset.id === slide.desktopAssetId)
    const mobile = assets.find((asset) => asset.id === slide.mobileAssetId) || desktop
    return {
      ...slide,
      desktopAsset: desktop ? { ...desktop, url: getStoredAssetUrl(desktop.objectKey) } : null,
      mobileAsset: mobile ? { ...mobile, url: getStoredAssetUrl(mobile.objectKey) } : null,
    }
  })
}
