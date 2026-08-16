import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { coupons } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { normalizeCouponCode } from '@/lib/coupons/engine'

function input(body: Record<string, unknown>) {
  const discountType = body.discountType === 'percent' || body.discountType === 'fixed' ? body.discountType : null
  const discountValue = Number(body.discountValue); const usageLimit = body.usageLimit === '' || body.usageLimit === null || body.usageLimit === undefined ? null : Number(body.usageLimit)
  if (!discountType || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100)) throw new Error('Enter a valid discount.')
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 0)) throw new Error('Usage limit must be a non-negative whole number.')
  const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null; const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null
  if ((startsAt && Number.isNaN(startsAt.valueOf())) || (endsAt && Number.isNaN(endsAt.valueOf())) || (startsAt && endsAt && endsAt <= startsAt)) throw new Error('End date must be after the start date.')
  return { code: normalizeCouponCode(body.code), description: typeof body.description === 'string' ? body.description.trim().slice(0, 3000) || null : null, discountType, discountValue: discountValue.toFixed(2), active: body.active !== false, startsAt, endsAt, usageLimit, perCustomerUsageLimit: body.perCustomerUsageLimit ? Number(body.perCustomerUsageLimit) : null, minimumSubtotal: body.minimumSubtotal ? Number(body.minimumSubtotal).toFixed(2) : null, maxDiscountAmount: body.maxDiscountAmount ? Number(body.maxDiscountAmount).toFixed(2) : null, visibility: ['private', 'public', 'customer_specific'].includes(String(body.visibility)) ? String(body.visibility) : 'private' }
}
export async function GET() { if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 }); return NextResponse.json({ data: { coupons: await db.select().from(coupons).orderBy(desc(coupons.createdAt)) } }) }
export async function POST(request: NextRequest) { try { if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 }); const body = await request.json() as Record<string, unknown>; const [coupon] = await db.insert(coupons).values(input(body)).returning(); return NextResponse.json({ data: { coupon } }, { status: 201 }) } catch (error) { return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Coupon could not be created.' } }, { status: 400 }) } }
