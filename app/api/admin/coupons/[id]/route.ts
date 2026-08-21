import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { couponCategories, couponCustomers, couponProducts, coupons, productCategories, products, users } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { couponAdminError, idList, parseCouponAdminInput } from '@/lib/coupons/admin'

async function ensureKnownIds(productIds: string[], categoryIds: string[], customerIds: string[]) {
  const [knownProducts, knownCategories, knownCustomers] = await Promise.all([
    productIds.length ? db.select({ id: products.id }).from(products).where(inArray(products.id, productIds)) : [],
    categoryIds.length ? db.select({ id: productCategories.id }).from(productCategories).where(inArray(productCategories.id, categoryIds)) : [],
    customerIds.length ? db.select({ id: users.id }).from(users).where(inArray(users.id, customerIds)) : [],
  ])
  if (knownProducts.length !== productIds.length || knownCategories.length !== categoryIds.length || knownCustomers.length !== customerIds.length) throw new Error('One or more selected products, categories, or customers no longer exist.')
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 })
    const { id } = await context.params; const body = await request.json() as Record<string, unknown>
    const data = parseCouponAdminInput(body); const productIds = idList(body.productIds); const categoryIds = idList(body.categoryIds); const customerIds = idList(body.customerIds)
    if (data.visibility === 'customer_specific' && !customerIds.length) throw new Error('Select at least one customer for a customer-specific coupon.')
    await ensureKnownIds(productIds, categoryIds, customerIds)
    const [coupon] = await db.transaction(async (tx) => {
      const result = await tx.update(coupons).set(data).where(eq(coupons.id, id)).returning()
      if (!result[0]) return result
      await Promise.all([tx.delete(couponProducts).where(eq(couponProducts.couponId, id)), tx.delete(couponCategories).where(eq(couponCategories.couponId, id)), tx.delete(couponCustomers).where(eq(couponCustomers.couponId, id))])
      if (productIds.length) await tx.insert(couponProducts).values(productIds.map((productId) => ({ couponId: id, productId })))
      if (categoryIds.length) await tx.insert(couponCategories).values(categoryIds.map((categoryId) => ({ couponId: id, categoryId })))
      if (customerIds.length) await tx.insert(couponCustomers).values(customerIds.map((userId) => ({ couponId: id, userId })))
      return result
    })
    return coupon ? NextResponse.json({ data: { coupon } }) : NextResponse.json({ error: { message: 'Coupon not found.' } }, { status: 404 })
  } catch (error) { console.error('Coupon update failed', error); const result = couponAdminError(error, 'Coupon could not be updated.'); return NextResponse.json({ error: result.error }, { status: result.status }) }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 })
  const { id } = await context.params
  try {
    const [coupon] = await db.delete(coupons).where(eq(coupons.id, id)).returning({ id: coupons.id })
    return coupon ? NextResponse.json({ data: { deleted: true, archived: false } }) : NextResponse.json({ error: { message: 'Coupon not found.' } }, { status: 404 })
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : ''
    if (code === '23503') { const [coupon] = await db.update(coupons).set({ active: false }).where(eq(coupons.id, id)).returning({ id: coupons.id }); return coupon ? NextResponse.json({ data: { deleted: false, archived: true } }) : NextResponse.json({ error: { message: 'Coupon not found.' } }, { status: 404 }) }
    console.error('Coupon delete failed', error); const result = couponAdminError(error, 'Coupon could not be deleted or archived.'); return NextResponse.json({ error: result.error }, { status: result.status })
  }
}
