import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { coupons } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) { if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 }); const { id } = await context.params; const body = await request.json() as Record<string, unknown>; const changes: Record<string, unknown> = {}; if (typeof body.active === 'boolean') changes.active = body.active; if (typeof body.description === 'string') changes.description = body.description.trim().slice(0, 3000) || null; if (Object.keys(changes).length === 0) return NextResponse.json({ error: { message: 'No supported changes supplied.' } }, { status: 400 }); const [coupon] = await db.update(coupons).set(changes).where(eq(coupons.id, id)).returning(); return coupon ? NextResponse.json({ data: { coupon } }) : NextResponse.json({ error: { message: 'Coupon not found.' } }, { status: 404 }) }
