import { NextRequest, NextResponse } from 'next/server'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { coupons, heroSlides, homepagePromotions, offers, productImages, products, storageAssets } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function slug(value: unknown) {
  const result = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (!result || result.length > 255) throw new Error('Enter a valid offer URL slug.')
  return result
}

function assetId(value: unknown, label: string) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new Error(`${label} is required. Upload an image before saving the offer.`)
  return value
}

export function parseOfferInput(body: Record<string, unknown>) {
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 255) : ''
  if (!title) throw new Error('Offer title is required.')
  const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null
  const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null
  if ((startsAt && Number.isNaN(startsAt.valueOf())) || (endsAt && Number.isNaN(endsAt.valueOf())) || (startsAt && endsAt && endsAt <= startsAt)) throw new Error('Offer end date must be after its start date.')
  const couponId = typeof body.couponId === 'string' && body.couponId ? body.couponId : null
  if (couponId && !uuid.test(couponId)) throw new Error('Choose a valid linked coupon.')
  const mobileImageAssetId = typeof body.mobileImageAssetId === 'string' && body.mobileImageAssetId ? assetId(body.mobileImageAssetId, 'Mobile offer image') : null
  const ctaLabel = typeof body.ctaLabel === 'string' ? body.ctaLabel.trim().slice(0, 120) : ''
  const ctaUrl = typeof body.ctaUrl === 'string' ? body.ctaUrl.trim().slice(0, 2000) : ''
  if (Boolean(ctaLabel) !== Boolean(ctaUrl)) throw new Error('CTA label and CTA URL must be provided together.')
  if (ctaUrl && !/^\/(?!\/)[^\s]*$|^https:\/\/[^\s]+$/i.test(ctaUrl)) throw new Error('CTA URL must be a local path or a secure HTTPS URL.')
  return {
    title,
    slug: slug(body.slug || title),
    couponId,
    shortDescription: typeof body.shortDescription === 'string' ? body.shortDescription.trim().slice(0, 1000) || null : null,
    fullDescription: typeof body.fullDescription === 'string' ? body.fullDescription.trim().slice(0, 10000) || null : null,
    terms: typeof body.terms === 'string' ? body.terms.trim().slice(0, 10000) || null : null,
    imageAssetId: assetId(body.imageAssetId, 'Offer hero image'),
    mobileImageAssetId,
    // URLs are legacy read-only fields. New offers always use asset records.
    imageUrl: null,
    mobileImageUrl: null,
    badgeText: typeof body.badgeText === 'string' ? body.badgeText.trim().slice(0, 100) || null : null,
    ctaLabel: ctaLabel || null,
    ctaUrl: ctaUrl || null,
    showOnHomepage: body.showOnHomepage === true,
    showInOffersPage: body.showInOffersPage !== false,
    showInProfile: body.showInProfile !== false,
    featured: body.featured === true,
    enabled: body.enabled !== false,
    startsAt,
    endsAt,
    displayOrder: Number.isInteger(Number(body.displayOrder)) ? Number(body.displayOrder) : 0,
    updatedAt: new Date(),
  }
}

export async function validateOfferReferences(input: ReturnType<typeof parseOfferInput>) {
  const assetIds = [input.imageAssetId, input.mobileImageAssetId].filter((id): id is string => Boolean(id))
  const [assets, couponRows] = await Promise.all([
    db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds)),
    input.couponId ? db.select({ id: coupons.id }).from(coupons).where(eq(coupons.id, input.couponId)).limit(1) : Promise.resolve([]),
  ])
  if (assets.length !== assetIds.length || assets.some((asset) => !['image/png', 'image/jpeg', 'image/webp'].includes(asset.contentType) || asset.status !== 'available')) throw new Error('Offer imagery must be uploaded PNG, JPG, or WebP assets that are available in storage.')
  if (input.couponId && !couponRows.length) throw new Error('The selected coupon no longer exists.')
}

function withAssetUrls<T extends typeof offers.$inferSelect>(rows: T[], assets: Array<typeof storageAssets.$inferSelect>) {
  return rows.map((offer) => {
    const image = assets.find((asset) => asset.id === offer.imageAssetId)
    const mobile = assets.find((asset) => asset.id === offer.mobileImageAssetId)
    return { ...offer, imageUrl: image ? getStoredAssetUrl(image.objectKey) : offer.imageUrl, mobileImageUrl: mobile ? getStoredAssetUrl(mobile.objectKey) : offer.mobileImageUrl }
  })
}

export async function getOffersWithAssetUrls() {
  const rows = await db.select().from(offers).orderBy(desc(offers.featured), asc(offers.displayOrder))
  const assetIds = [...new Set(rows.flatMap((offer) => [offer.imageAssetId, offer.mobileImageAssetId].filter((id): id is string => Boolean(id))))]
  const assets = assetIds.length ? await db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds)) : []
  return withAssetUrls(rows, assets)
}

export function offerAdminError(error: unknown, fallback: string) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : ''
  const message = error instanceof Error ? error.message : ''
  if (code === '23505' || /offers_slug|unique constraint/i.test(message)) return { status: 409, error: { code: 'OFFER_SLUG_EXISTS', field: 'slug', message: 'That offer URL slug is already in use. Enter a different slug.' } }
  if (code || /column .* does not exist|relation .* does not exist/i.test(message)) return { status: 500, error: { code: 'OFFER_DATABASE_ERROR', message: 'Offers are temporarily unavailable because the database is not up to date. Apply the latest migration and retry.' } }
  const field = /title/i.test(message) ? 'title' : /slug|url/i.test(message) ? 'slug' : /date/i.test(message) ? 'endsAt' : /image/i.test(message) ? 'imageAssetId' : undefined
  return { status: 400, error: { code: 'OFFER_VALIDATION_ERROR', ...(field ? { field } : {}), message: message || fallback } }
}

export async function GET() {
  try {
    if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 })
    const [rows, couponRows, imageAssets, activeHeroes, activePromotions, activeProductImages] = await Promise.all([getOffersWithAssetUrls(), db.select({ id: coupons.id, code: coupons.code }).from(coupons), db.select().from(storageAssets).where(inArray(storageAssets.contentType, ['image/png', 'image/jpeg', 'image/webp'])).orderBy(desc(storageAssets.updatedAt)), db.select({ desktop: heroSlides.desktopAssetId, mobile: heroSlides.mobileAssetId }).from(heroSlides).where(eq(heroSlides.enabled, true)), db.select({ assetId: homepagePromotions.imageAssetId }).from(homepagePromotions).where(eq(homepagePromotions.enabled, true)), db.select({ assetId: productImages.assetId }).from(productImages).innerJoin(products, eq(productImages.productId, products.id)).where(eq(products.active, true))])
    const heroIds=new Set(activeHeroes.flatMap((row)=>[row.desktop,row.mobile].filter((id):id is string=>Boolean(id)))),promotionIds=new Set(activePromotions.flatMap((row)=>row.assetId?[row.assetId]:[])),productIds=new Set(activeProductImages.flatMap((row)=>row.assetId?[row.assetId]:[]))
    const media = imageAssets.filter((asset) => asset.status === 'available' && (heroIds.has(asset.id)||promotionIds.has(asset.id)||productIds.has(asset.id))).map((asset) => ({ id: asset.id, filename: asset.filename, source: heroIds.has(asset.id) ? 'Hero' : promotionIds.has(asset.id) ? 'Promotion' : 'Product', url: getStoredAssetUrl(asset.objectKey) }))
    return NextResponse.json({ data: { offers: rows, coupons: couponRows, media } })
  } catch (error) {
    console.error('Offers load failed', error)
    const result = offerAdminError(error, 'Offers could not be loaded.')
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 })
    const input = parseOfferInput(await request.json() as Record<string, unknown>)
    await validateOfferReferences(input)
    const [offer] = await db.insert(offers).values(input).returning()
    return NextResponse.json({ data: { offer } }, { status: 201 })
  } catch (error) {
    console.error('Offer create failed', error)
    const result = offerAdminError(error, 'Offer could not be created.')
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
}
