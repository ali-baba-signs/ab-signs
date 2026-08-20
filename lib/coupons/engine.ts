import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { couponCategories, couponCustomers, couponProducts, couponRedemptions, couponReservations, coupons } from '@/lib/db/schema'
import { expireCouponReservations } from '@/lib/coupons/reservations'

export type CouponItem = { productId: string; categoryId: string; totalCents: number }
export type AppliedCoupon = { id: string; code: string; discountType: string; discountValue: string; discountCents: number; description: string | null; usageLimit: number | null; perCustomerUsageLimit: number | null }

export function normalizeCouponCode(input: unknown) {
  const code = typeof input === 'string' ? input.trim().toUpperCase() : ''
  if (!/^[A-Z0-9_-]{3,80}$/.test(code)) throw new Error('Enter a valid coupon code.')
  return code
}

export async function validateCoupon(codeInput: unknown, items: CouponItem[], userId?: string | null): Promise<AppliedCoupon> {
  await expireCouponReservations()
  const code = normalizeCouponCode(codeInput)
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1)
  if (!coupon) throw new Error('Invalid coupon code.')
  const now = new Date()
  if (!coupon.active) throw new Error('This coupon is not active.')
  if (coupon.startsAt && now < coupon.startsAt) throw new Error('This coupon has not started yet.')
  if (coupon.endsAt && now > coupon.endsAt) throw new Error('This coupon has expired.')
  if (coupon.usageLimit !== null && coupon.usedCount + coupon.reservedCount >= coupon.usageLimit) throw new Error('This coupon usage limit has been reached.')
  if (coupon.visibility === 'customer_specific') {
    if (!userId) throw new Error('Sign in to use this customer-specific coupon.')
    const [assignment] = await db.select({ userId: couponCustomers.userId }).from(couponCustomers).where(and(eq(couponCustomers.couponId, coupon.id), eq(couponCustomers.userId, userId))).limit(1)
    if (!assignment) throw new Error('This coupon is not available for your account.')
  }
  if (coupon.perCustomerUsageLimit && userId) {
    const [uses, holds] = await Promise.all([
      db.select({ id: couponRedemptions.id }).from(couponRedemptions).where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.userId, userId))).limit(coupon.perCustomerUsageLimit),
      db.select({ id: couponReservations.id }).from(couponReservations).where(and(eq(couponReservations.couponId, coupon.id), eq(couponReservations.userId, userId), eq(couponReservations.status, 'reserved'))).limit(coupon.perCustomerUsageLimit),
    ])
    if (uses.length + holds.length >= coupon.perCustomerUsageLimit) throw new Error('You have already used or reserved this coupon.')
  }
  const [allowedProducts, allowedCategories] = await Promise.all([
    db.select({ productId: couponProducts.productId }).from(couponProducts).where(eq(couponProducts.couponId, coupon.id)),
    db.select({ categoryId: couponCategories.categoryId }).from(couponCategories).where(eq(couponCategories.couponId, coupon.id)),
  ])
  const productIds = new Set(allowedProducts.map((row) => row.productId)); const categoryIds = new Set(allowedCategories.map((row) => row.categoryId))
  const eligible = !productIds.size && !categoryIds.size ? items : items.filter((item) => productIds.has(item.productId) || categoryIds.has(item.categoryId))
  const eligibleCents = eligible.reduce((total, item) => total + item.totalCents, 0)
  if (!eligibleCents) throw new Error('This coupon is not valid for the items in your cart.')
  if (coupon.minimumSubtotal && eligibleCents < Math.round(Number(coupon.minimumSubtotal) * 100)) throw new Error(`Spend at least $${Number(coupon.minimumSubtotal).toFixed(2)} to use this coupon.`)
  const raw = coupon.discountType === 'percent' ? Math.round(eligibleCents * Number(coupon.discountValue) / 100) : Math.round(Number(coupon.discountValue) * 100)
  const maximum = coupon.maxDiscountAmount ? Math.round(Number(coupon.maxDiscountAmount) * 100) : raw
  const discountCents = Math.max(0, Math.min(raw, maximum, eligibleCents))
  return { id: coupon.id, code: coupon.code, discountType: coupon.discountType, discountValue: String(coupon.discountValue), discountCents, description: coupon.description, usageLimit: coupon.usageLimit, perCustomerUsageLimit: coupon.perCustomerUsageLimit }
}
