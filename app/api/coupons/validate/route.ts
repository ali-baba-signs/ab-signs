import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { products } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { getSession } from '@/lib/auth/middleware'
import { validateCoupon } from '@/lib/coupons/engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { code?: string; items?: Array<{ productId?: string; quantity?: number; unitPrice?: number }> }
    const requested = body.items || []; const productIds = [...new Set(requested.map((item) => item.productId).filter((id): id is string => Boolean(id)))]
    if (!productIds.length) throw new Error('Add an item before applying a coupon.')
    const rows = await db.select({ id: products.id, categoryId: products.categoryId }).from(products).where(inArray(products.id, productIds))
    const items = requested.map((item) => { const product = rows.find((row) => row.id === item.productId); const quantity = Number(item.quantity); const unitPrice = Number(item.unitPrice); if (!product || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Your cart needs to be refreshed before applying a coupon.'); return { productId: product.id, categoryId: product.categoryId, totalCents: Math.round(quantity * unitPrice * 100) } })
    const session = await getSession(); const coupon = await validateCoupon(body.code, items, session?.user.id)
    return NextResponse.json({ data: { coupon: { ...coupon, discountAmount: (coupon.discountCents / 100).toFixed(2) } } })
  } catch (error) { return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Coupon could not be applied.' } }, { status: 400 }) }
}
