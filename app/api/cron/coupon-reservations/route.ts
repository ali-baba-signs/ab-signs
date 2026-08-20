import { NextRequest, NextResponse } from 'next/server'
import { expireCouponReservations } from '@/lib/coupons/reservations'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    return NextResponse.json({ data: await expireCouponReservations({ limit: 200 }) })
  } catch (error) {
    console.error('Coupon reservation cleanup failed', error)
    return NextResponse.json({ error: 'Coupon reservation cleanup failed.' }, { status: 500 })
  }
}
