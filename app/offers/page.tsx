import Link from 'next/link'
import { and, asc, eq, gt, isNull, lt, or, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { coupons, offers, storageAssets } from '@/lib/db/schema'
import { CopyCouponButton } from '@/components/offers/copy-coupon-button'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'

export const dynamic = 'force-dynamic'

function discount(coupon: typeof coupons.$inferSelect) {
  return coupon.discountType === 'percent' ? `${coupon.discountValue}% OFF` : `$${coupon.discountValue} OFF`
}

export default async function OffersPage() {
  const now = new Date()
  const [offerRows, publicCoupons] = await Promise.all([
    db.select({ offer: offers, coupon: coupons }).from(offers).leftJoin(coupons, eq(offers.couponId, coupons.id)).where(and(eq(offers.enabled, true), eq(offers.showInOffersPage, true), or(isNull(offers.startsAt), lt(offers.startsAt, now)), or(isNull(offers.endsAt), gt(offers.endsAt, now)))).orderBy(asc(offers.displayOrder)),
    db.select().from(coupons).where(and(eq(coupons.visibility, 'public'), eq(coupons.active, true), or(isNull(coupons.startsAt), lt(coupons.startsAt, now)), or(isNull(coupons.endsAt), gt(coupons.endsAt, now)))).orderBy(asc(coupons.endsAt)),
  ])
  const visibleOffers = offerRows.filter(({ coupon }) => !coupon || (coupon.visibility === 'public' && coupon.active && (coupon.usageLimit === null || coupon.usedCount + coupon.reservedCount < coupon.usageLimit)))
  const offerAssetIds = [...new Set(visibleOffers.flatMap(({ offer }) => [offer.imageAssetId, offer.mobileImageAssetId].filter((assetId): assetId is string => Boolean(assetId))))]
  const offerAssets = offerAssetIds.length ? await db.select().from(storageAssets).where(inArray(storageAssets.id, offerAssetIds)) : []
  const linked = new Set(visibleOffers.flatMap(({ coupon }) => coupon ? [coupon.id] : []))
  const standaloneCoupons = publicCoupons.filter((coupon) => !linked.has(coupon.id) && (coupon.usageLimit === null || coupon.usedCount + coupon.reservedCount < coupon.usageLimit))
  return <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-16"><p className="text-sm font-bold uppercase tracking-wide text-primary">Savings</p><h1 className="mt-2 text-4xl font-black">Offers &amp; Vouchers</h1><p className="mt-3 text-muted-foreground">Browse public promotions and copy an active voucher code for checkout.</p>
    {visibleOffers.length > 0 && <section className="mt-10"><h2 className="text-2xl font-black">Current offers</h2><div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{visibleOffers.map(({ offer, coupon }) => { const image = offerAssets.find((asset) => asset.id === offer.imageAssetId); const imageUrl = image ? getStoredAssetUrl(image.objectKey) : offer.imageUrl; return <article key={offer.id} className="overflow-hidden rounded-xl border bg-card">{imageUrl && <img src={imageUrl} alt="" className="h-44 w-full object-cover" />}<div className="p-5">{offer.badgeText && <p className="text-xs font-bold text-primary">{offer.badgeText}</p>}<h3 className="mt-1 text-xl font-bold">{offer.title}</h3><p className="mt-2 text-sm text-muted-foreground">{offer.shortDescription}</p>{offer.endsAt && <p className="mt-2 text-xs font-semibold">Ends {offer.endsAt.toLocaleDateString()}</p>}{coupon && <div className="mt-4 flex items-center justify-between gap-2"><div><p className="text-3xl font-black text-primary">{discount(coupon)}</p><p className="mt-1 font-black">{coupon.code}</p><p className="text-xs text-muted-foreground">{coupon.endsAt ? `Expires ${coupon.endsAt.toLocaleDateString()}` : 'No scheduled expiry'}</p></div><CopyCouponButton code={coupon.code} /></div>}<div className="mt-5 flex flex-wrap items-center gap-3">
  <Link
    href={`/offers/${offer.slug}`}
    className="inline-flex items-center justify-center rounded-md bg-[#ed1b68] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#c91556] focus-visible:outline-2 focus-visible:outline-offset-4"
  >
    {offer.ctaLabel || 'View Offer'}
  </Link>

  {offer.terms && (
    <Link
      href={`/offers/${offer.slug}#terms`}
      className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      Terms &amp; Conditions
    </Link>
  )}
</div></div></article> })}</div></section>}
    {standaloneCoupons.length > 0 && <section className="mt-12"><h2 className="text-2xl font-black">Active voucher codes</h2><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{standaloneCoupons.map((coupon) => <article key={coupon.id} className="rounded-xl border bg-card p-5"><p className="text-xs font-bold text-primary">PUBLIC VOUCHER</p><h3 className="mt-1 text-2xl font-black">{coupon.code}</h3><p className="mt-2 font-semibold">{discount(coupon)}</p>{coupon.description && <p className="mt-2 text-sm text-muted-foreground">{coupon.description}</p>}<p className="mt-3 text-xs">{coupon.endsAt ? `Expires ${coupon.endsAt.toLocaleDateString()}` : 'No scheduled expiry'}</p><div className="mt-4"><CopyCouponButton code={coupon.code} /></div></article>)}</div></section>}
    {!visibleOffers.length && !standaloneCoupons.length && <p className="mt-8 rounded-xl border border-dashed p-8 text-muted-foreground">There are no current public offers. Please check back soon.</p>}
  </main>
}
