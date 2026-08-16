import { NextResponse } from 'next/server'
import { and, asc, eq, gt, isNull, or, lt } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { coupons, offers } from '@/lib/db/schema'

export async function GET() {
  const now = new Date()
  const rows = await db.select({ offer: offers, coupon: coupons }).from(offers).leftJoin(coupons, eq(offers.couponId, coupons.id)).where(and(eq(offers.enabled, true), eq(offers.showInOffersPage, true), or(isNull(offers.startsAt), lt(offers.startsAt, now)), or(isNull(offers.endsAt), gt(offers.endsAt, now)))).orderBy(asc(offers.displayOrder))
  return NextResponse.json({ data: { offers: rows.filter(({ coupon }) => !coupon || (coupon.visibility === 'public' && coupon.active && (!coupon.startsAt || coupon.startsAt <= now) && (!coupon.endsAt || coupon.endsAt >= now) && (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit))) } })
}
