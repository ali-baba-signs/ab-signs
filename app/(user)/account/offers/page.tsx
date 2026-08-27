import Link from 'next/link'
import { and, asc, eq, gt, isNull, lt, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db/client'
import { couponCustomers, couponRedemptions, couponReservations, coupons, offers } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { CopyCouponButton } from '@/components/offers/copy-coupon-button'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

type OfferCardRow = {
  offer: typeof offers.$inferSelect
  coupon: typeof coupons.$inferSelect | null
}

function OfferCards({ rows, empty }: { rows: OfferCardRow[]; empty: string }) {
  return rows.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{rows.map(({ offer, coupon }) => <article key={offer.id} className="rounded-xl border bg-card p-5"><p className="text-xs font-bold text-primary">{offer.badgeText || 'OFFER'}</p><h2 className="mt-1 text-xl font-bold">{offer.title}</h2><p className="mt-2 text-sm text-muted-foreground">{offer.shortDescription}</p>{coupon && <div className="mt-4 flex items-center justify-between gap-3"><div><p className="font-black">{coupon.code}</p><p className="text-sm">{coupon.discountType === 'percent' ? `${coupon.discountValue}% off` : `$${coupon.discountValue} off`}{coupon.endsAt ? ` · Ends ${coupon.endsAt.toLocaleDateString()}` : ''}</p></div><CopyCouponButton code={coupon.code}/></div>}<Link href={`/offers/${offer.slug}`} className="mt-4 inline-block text-sm font-semibold text-primary underline">View terms</Link></article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
}

export default async function AccountOffersPage() {
  const session = await getSession(); if (!session?.user) redirect('/sign-in?callbackUrl=/account/offers')
  const now = new Date()
  const [offerRows, assignments, redemptions, reservations] = await Promise.all([
    db.select({ offer: offers, coupon: coupons }).from(offers).leftJoin(coupons, eq(offers.couponId, coupons.id)).where(eq(offers.showInProfile, true)).orderBy(asc(offers.displayOrder)),
    db.select({ couponId: couponCustomers.couponId }).from(couponCustomers).where(eq(couponCustomers.userId, session.user.id)),
    db.select().from(couponRedemptions).where(eq(couponRedemptions.userId, session.user.id)),
    db.select().from(couponReservations).where(and(eq(couponReservations.userId, session.user.id), eq(couponReservations.status, 'reserved'))),
  ])
  const assigned = new Set(assignments.map((assignment) => assignment.couponId))
  const personalUseCount = (couponId: string) => redemptions.filter((row) => row.couponId === couponId).length + reservations.filter((row) => row.couponId === couponId).length
  const visible = offerRows.filter(({ offer, coupon }) => offer.enabled && (!coupon || coupon.visibility === 'public' || (coupon.visibility === 'customer_specific' && assigned.has(coupon.id))) && (!coupon?.perCustomerUsageLimit || personalUseCount(coupon.id) < coupon.perCustomerUsageLimit))
  const active = visible.filter(({ offer, coupon }) => (!offer.startsAt || offer.startsAt <= now) && (!offer.endsAt || offer.endsAt >= now) && (!coupon || (coupon.active && (!coupon.startsAt || coupon.startsAt <= now) && (!coupon.endsAt || coupon.endsAt >= now) && (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit))))
  const expired = visible.filter(({ offer, coupon }) => Boolean((offer.endsAt && offer.endsAt < now) || (coupon && coupon.endsAt && coupon.endsAt < now) || (coupon && coupon.usageLimit !== null && coupon.usedCount + coupon.reservedCount >= coupon.usageLimit)))
  const redeemed = redemptions.map((redemption) => ({ redemption, coupon: offerRows.find((row) => row.coupon?.id === redemption.couponId)?.coupon })).filter((row): row is { redemption: typeof redemptions[number]; coupon: NonNullable<typeof offerRows[number]['coupon']> } => Boolean(row.coupon))
  return <main className="mx-auto min-h-[65vh] max-w-5xl px-4 py-10"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-primary">ACCOUNT</p><h1 className="mt-1 text-3xl font-black">My Offers</h1></div><Link href="/account/profile"><Button variant="outline">My profile</Button></Link></div><section className="mt-8"><h2 className="text-xl font-bold">Available offers</h2><OfferCards rows={active} empty="There are no offers available to your account right now."/></section><section className="mt-10"><h2 className="text-xl font-bold">Used coupons</h2>{redeemed.length ? <div className="mt-4 space-y-3">{redeemed.map(({ redemption, coupon }) => <article key={redemption.id} className="flex flex-wrap justify-between gap-3 rounded-xl border p-4"><div><p className="font-bold">{coupon.code}</p><p className="text-sm text-muted-foreground">Redeemed {redemption.redeemedAt.toLocaleDateString()} · ${Number(redemption.discountAmount).toFixed(2)} saved</p></div><span className="text-sm font-semibold">{redemption.status}</span></article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">You have not redeemed any coupons yet.</p>}</section><section className="mt-10"><h2 className="text-xl font-bold">Expired offers</h2><OfferCards rows={expired} empty="No expired offers to show."/></section></main>
}
