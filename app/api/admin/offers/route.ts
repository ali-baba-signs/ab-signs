import { NextRequest, NextResponse } from 'next/server'
import { asc, desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { coupons, offers } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'

function slug(value: unknown) {
  const result = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (!result || result.length > 255) throw new Error('Enter a valid offer URL slug.')
  return result
}
export function parseOfferInput(body: Record<string, unknown>) {
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 255) : ''
  if (!title) throw new Error('Offer title is required.')
  const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null; const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null
  if ((startsAt && Number.isNaN(startsAt.valueOf())) || (endsAt && Number.isNaN(endsAt.valueOf())) || (startsAt && endsAt && endsAt <= startsAt)) throw new Error('Offer end date must be after its start date.')
  return { title, slug: slug(body.slug || title), couponId: typeof body.couponId === 'string' && body.couponId ? body.couponId : null, shortDescription: typeof body.shortDescription === 'string' ? body.shortDescription.trim().slice(0, 1000) || null : null, fullDescription: typeof body.fullDescription === 'string' ? body.fullDescription.trim().slice(0, 10000) || null : null, terms: typeof body.terms === 'string' ? body.terms.trim().slice(0, 10000) || null : null, imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl.trim().slice(0, 2000) || null : null, mobileImageUrl: typeof body.mobileImageUrl === 'string' ? body.mobileImageUrl.trim().slice(0, 2000) || null : null, badgeText: typeof body.badgeText === 'string' ? body.badgeText.trim().slice(0, 100) || null : null, ctaLabel: typeof body.ctaLabel === 'string' ? body.ctaLabel.trim().slice(0, 120) || null : null, ctaUrl: typeof body.ctaUrl === 'string' ? body.ctaUrl.trim().slice(0, 2000) || null : null, showOnHomepage: body.showOnHomepage === true, showInOffersPage: body.showInOffersPage !== false, showInProfile: body.showInProfile !== false, featured: body.featured === true, enabled: body.enabled !== false, startsAt, endsAt, displayOrder: Number.isInteger(Number(body.displayOrder)) ? Number(body.displayOrder) : 0, updatedAt: new Date() }
}
export async function GET() { if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 }); const [rows, couponRows] = await Promise.all([db.select().from(offers).orderBy(desc(offers.featured), asc(offers.displayOrder)), db.select({ id: coupons.id, code: coupons.code }).from(coupons)]); return NextResponse.json({ data: { offers: rows, coupons: couponRows } }) }
export async function POST(request: NextRequest) { try { if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 }); const [offer] = await db.insert(offers).values(parseOfferInput(await request.json() as Record<string, unknown>)).returning(); return NextResponse.json({ data: { offer } }, { status: 201 }) } catch (error) { return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Offer could not be created.' } }, { status: 400 }) } }
