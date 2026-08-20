import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { offers } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { parseOfferInput } from '../route'
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) { try { if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 }); const { id } = await context.params; const [offer] = await db.update(offers).set(parseOfferInput(await request.json() as Record<string, unknown>)).where(eq(offers.id, id)).returning(); return offer ? NextResponse.json({ data: { offer } }) : NextResponse.json({ error: { message: 'Offer not found.' } }, { status: 404 }) } catch (error) { return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Offer could not be updated.' } }, { status: 400 }) } }
export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) { if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 }); const { id } = await context.params; const [offer] = await db.delete(offers).where(eq(offers.id, id)).returning({ id: offers.id }); return offer ? NextResponse.json({ data: { deleted: true } }) : NextResponse.json({ error: { message: 'Offer not found.' } }, { status: 404 }) }
