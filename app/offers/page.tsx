import Link from 'next/link'
import { and, asc, eq, gt, isNull, lt, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { coupons, offers } from '@/lib/db/schema'
import { CopyCouponButton } from '@/components/offers/copy-coupon-button'
export const dynamic = 'force-dynamic';
export default async function OffersPage() {
  const now = new Date(); const rows = await db.select({ offer: offers, coupon: coupons }).from(offers).leftJoin(coupons, eq(offers.couponId, coupons.id)).where(and(eq(offers.enabled, true), eq(offers.showInOffersPage, true), or(isNull(offers.startsAt), lt(offers.startsAt, now)), or(isNull(offers.endsAt), gt(offers.endsAt, now)))).orderBy(asc(offers.displayOrder))
  const visible = rows.filter(({ coupon }) => !coupon || (coupon.visibility === 'public' && coupon.active && (!coupon.startsAt || coupon.startsAt <= now) && (!coupon.endsAt || coupon.endsAt >= now) && (coupon.usageLimit === null || coupon.usedCount + coupon.reservedCount < coupon.usageLimit)))
  if (!visible.length) return <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-16"><h1 className="text-4xl font-black">Offers &amp; Vouchers</h1><p className="mt-4 text-muted-foreground">There are no current offers. Please check back soon.</p></main>
  return <main className="mx-auto max-w-6xl px-4 py-16"><h1 className="text-4xl font-black">Current Offers</h1><div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{visible.map(({ offer, coupon }) => <article key={offer.id} className="overflow-hidden rounded-xl border bg-card"><>{offer.imageUrl && <img src={offer.imageUrl} alt="" className="h-44 w-full object-cover"/>}</><div className="p-5">{offer.badgeText && <p className="text-xs font-bold text-primary">{offer.badgeText}</p>}<h2 className="mt-1 text-xl font-bold">{offer.title}</h2><p className="mt-2 text-sm text-muted-foreground">{offer.shortDescription}</p>{coupon && <div className="mt-4 flex items-center justify-between gap-2"><p className="font-semibold">{coupon.code} · {coupon.discountType === 'percent' ? `${coupon.discountValue}% off` : `$${coupon.discountValue} off`}</p><CopyCouponButton code={coupon.code}/></div>}<Link className="mt-5 inline-block font-semibold text-primary underline" href={`/offers/${offer.slug}`}>{offer.ctaLabel || 'View offer'}</Link></div></article>)}</div></main>
}
