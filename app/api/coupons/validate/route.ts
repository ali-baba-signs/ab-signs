import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { couponCustomers, coupons, productSizes, productTemplateSizePrices, products, templateSizes } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { validateCoupon } from '@/lib/coupons/engine'

type RequestedItem = { productId?: string; sizeId?: string; quantity?: number }

// This endpoint derives its subtotal from the catalogue instead of trusting a
// browser-supplied cart price. Order creation repeats this immediately before
// Stripe payment is prepared.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { code?: string; items?: RequestedItem[] }
    const requested = Array.isArray(body.items) ? body.items : []
    const productIds = [...new Set(requested.map((item) => item.productId).filter((id): id is string => Boolean(id)))]
    const sizeIds = [...new Set(requested.map((item) => item.sizeId).filter((id): id is string => Boolean(id)))]
    if (!requested.length || !productIds.length || !sizeIds.length) throw new Error('Add an item before applying a coupon.')

    const [productRows, productSizeRows, templateSizeRows, priceRows] = await Promise.all([
      db.select({ id: products.id, categoryId: products.categoryId, templateId: products.templateId, sizeMode: products.sizeMode, active: products.active }).from(products).where(inArray(products.id, productIds)),
      db.select().from(productSizes).where(inArray(productSizes.id, sizeIds)),
      db.select().from(templateSizes).where(inArray(templateSizes.id, sizeIds)),
      db.select().from(productTemplateSizePrices),
    ])
    const items = requested.map((item) => {
      const quantity = Number(item.quantity)
      const product = productRows.find((row) => row.id === item.productId && row.active)
      if (!product || !item.sizeId || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('Your cart needs to be refreshed before applying a coupon.')
      const productSize = productSizeRows.find((row) => row.id === item.sizeId && row.productId === product.id && row.enabled)
      const templateSize = product.sizeMode === 'template_sizes' && product.templateId ? templateSizeRows.find((row) => row.id === item.sizeId && row.templateId === product.templateId && row.enabled) : null
      const price = templateSize ? priceRows.find((row) => row.productId === product.id && row.templateSizeId === templateSize.id && row.enabled) : null
      const unitPrice = templateSize ? price?.unitPrice : productSize?.unitPrice
      if (unitPrice === undefined || unitPrice === null) throw new Error('Your selected product size is no longer available.')
      return { productId: product.id, categoryId: product.categoryId, totalCents: Math.round(Number(unitPrice) * quantity * 100) }
    })
    const session = await getSession()
    if (!body.code) {
      if (!session?.user) return NextResponse.json({ data: { coupons: [] } })
      const assigned = await db.select({ couponId: couponCustomers.couponId }).from(couponCustomers).where(eq(couponCustomers.userId, session.user.id))
      const assignedIds = assigned.map((row) => row.couponId)
      const candidates = await db.select({ code: coupons.code }).from(coupons).where(and(eq(coupons.active, true), assignedIds.length ? or(eq(coupons.visibility, 'public'), inArray(coupons.id, assignedIds)) : eq(coupons.visibility, 'public')))
      const checked = await Promise.all(candidates.map(async ({ code }) => {
        try { const coupon = await validateCoupon(code, items, session.user.id); return { ...coupon, discountAmount: (coupon.discountCents / 100).toFixed(2) } }
        catch { return null }
      }))
      return NextResponse.json({ data: { coupons: checked.filter(Boolean) } })
    }
    const coupon = await validateCoupon(body.code, items, session?.user.id)
    return NextResponse.json({ data: { coupon: { ...coupon, discountAmount: (coupon.discountCents / 100).toFixed(2) } } })
  } catch (error) {
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Coupon could not be applied.' } }, { status: 400 })
  }
}
