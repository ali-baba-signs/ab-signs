import { NextResponse } from 'next/server'
import { and, asc, eq, gt, isNull, or, lt, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { coupons, offers, storageAssets } from '@/lib/db/schema'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'

export async function GET() {
  const now = new Date()
  const rows = await db.select({ offer: offers, coupon: coupons }).from(offers).leftJoin(coupons, eq(offers.couponId, coupons.id)).where(and(eq(offers.enabled, true), eq(offers.showInOffersPage, true), or(isNull(offers.startsAt), lt(offers.startsAt, now)), or(isNull(offers.endsAt), gt(offers.endsAt, now)))).orderBy(asc(offers.displayOrder))
  const assetIds = [...new Set(rows.flatMap(({ offer }) => [offer.imageAssetId, offer.mobileImageAssetId].filter((id): id is string => Boolean(id))))]
  const assets = assetIds.length ? await db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds)) : []
  const visible = rows.filter(({ coupon }) => !coupon || (coupon.visibility === 'public' && coupon.active && (!coupon.startsAt || coupon.startsAt <= now) && (!coupon.endsAt || coupon.endsAt >= now) && (coupon.usageLimit === null || coupon.usedCount + coupon.reservedCount < coupon.usageLimit)))
  return NextResponse.json({ data: { offers: visible.map((row) => ({ ...row, offer: { ...row.offer, imageUrl: assets.find((asset) => asset.id === row.offer.imageAssetId) ? getStoredAssetUrl(assets.find((asset) => asset.id === row.offer.imageAssetId)!.objectKey) : row.offer.imageUrl, mobileImageUrl: assets.find((asset) => asset.id === row.offer.mobileImageAssetId) ? getStoredAssetUrl(assets.find((asset) => asset.id === row.offer.mobileImageAssetId)!.objectKey) : row.offer.mobileImageUrl } })) } })
}
