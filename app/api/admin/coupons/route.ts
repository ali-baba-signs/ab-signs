import { NextRequest, NextResponse } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { couponCategories, couponCustomers, couponProducts, coupons, productCategories, products, users } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { couponAdminError, idList, parseCouponAdminInput } from '@/lib/coupons/admin'

async function couponDetails() {
  const [rows, productLinks, categoryLinks, customerLinks, productRows, categoryRows, customerRows] = await Promise.all([
    db.select().from(coupons).orderBy(desc(coupons.createdAt)), db.select().from(couponProducts), db.select().from(couponCategories), db.select().from(couponCustomers),
    db.select({ id: products.id, name: products.name }).from(products), db.select({ id: productCategories.id, name: productCategories.name }).from(productCategories),
    db.select({ id: users.id, email: users.email, name: users.name }).from(users),
  ])
  return {
    coupons: rows.map((coupon) => ({ ...coupon, productIds: productLinks.filter((link) => link.couponId === coupon.id).map((link) => link.productId), categoryIds: categoryLinks.filter((link) => link.couponId === coupon.id).map((link) => link.categoryId), customerIds: customerLinks.filter((link) => link.couponId === coupon.id).map((link) => link.userId) })),
    products: productRows, categories: categoryRows, customers: customerRows,
  }
}

async function ensureKnownIds(productIds: string[], categoryIds: string[], customerIds: string[]) {
  const [knownProducts, knownCategories, knownCustomers] = await Promise.all([
    productIds.length ? db.select({ id: products.id }).from(products).where(inArray(products.id, productIds)) : [],
    categoryIds.length ? db.select({ id: productCategories.id }).from(productCategories).where(inArray(productCategories.id, categoryIds)) : [],
    customerIds.length ? db.select({ id: users.id }).from(users).where(inArray(users.id, customerIds)) : [],
  ])
  if (knownProducts.length !== productIds.length || knownCategories.length !== categoryIds.length || knownCustomers.length !== customerIds.length) throw new Error('One or more selected products, categories, or customers no longer exist.')
}

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 })
  try { return NextResponse.json({ data: await couponDetails() }) }
  catch (error) { console.error('Coupon list failed', error); const result = couponAdminError(error, 'Coupons could not be loaded.'); return NextResponse.json({ error: result.error }, { status: result.status }) }
}

export async function POST(request: NextRequest) {
  try {
    if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 })
    const body = await request.json() as Record<string, unknown>
    const data = parseCouponAdminInput(body); const productIds = idList(body.productIds); const categoryIds = idList(body.categoryIds); const customerIds = idList(body.customerIds)
    if (data.visibility === 'customer_specific' && !customerIds.length) throw new Error('Select at least one customer for a customer-specific coupon.')
    await ensureKnownIds(productIds, categoryIds, customerIds)
    const [coupon] = await db.transaction(async (tx) => {
      const result = await tx.insert(coupons).values(data).returning()
      if (productIds.length) await tx.insert(couponProducts).values(productIds.map((productId) => ({ couponId: result[0].id, productId })))
      if (categoryIds.length) await tx.insert(couponCategories).values(categoryIds.map((categoryId) => ({ couponId: result[0].id, categoryId })))
      if (customerIds.length) await tx.insert(couponCustomers).values(customerIds.map((userId) => ({ couponId: result[0].id, userId })))
      return result
    })
    return NextResponse.json({ data: { coupon } }, { status: 201 })
  } catch (error) {
    console.error('Coupon create failed', error)
    const result = couponAdminError(error, 'Coupon could not be created.')
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
}
