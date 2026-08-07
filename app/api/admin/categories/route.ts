import { NextRequest, NextResponse } from 'next/server'
import { asc, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, productCategories, storageAssets } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 120) : ''
}

function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
}

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const [categories, assets] = await Promise.all([db.select().from(productCategories).orderBy(asc(productCategories.name)), db.select().from(storageAssets)])
  return NextResponse.json({ data: { categories: categories.map((category) => { const asset = assets.find((row) => row.id === category.imageAssetId); return { ...category, imageUrl: asset ? getStoredAssetUrl(asset.objectKey) : null } }) } })
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const body = await request.json() as Record<string, unknown>
    const name = normalizeName(body.name)
    const slug = slugify(name)
    if (name.length < 2 || !slug) throw new Error('Category name must contain at least two letters or numbers.')
    const [duplicate] = await db.select().from(productCategories).where(sql`lower(${productCategories.name}) = lower(${name})`).limit(1)
    if (duplicate) return NextResponse.json({ error: { code: 'CATEGORY_EXISTS', message: 'A category with this name already exists.', existing: duplicate } }, { status: 409 })
    const imageAssetId = typeof body.imageAssetId === 'string' ? body.imageAssetId : null
    if (imageAssetId) {
      const [asset] = await db.select().from(storageAssets).where(sql`${storageAssets.id} = ${imageAssetId}::uuid`).limit(1)
      if (!asset?.contentType.startsWith('image/')) throw new Error('Select a valid category image.')
    }
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : ''
    const displayOrder = Math.max(0, Math.floor(Number(body.displayOrder) || 0))
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx.insert(productCategories).values({ name, slug, description, category: 'custom_banners', imageAssetId, enabled: body.enabled !== false, showOnHomepage: body.showOnHomepage === true, displayOrder }).returning()
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'category.created', entityType: 'product_category', entityId: rows[0].id, entityName: name, description: `Created product category ${name}.`, metadata: { slug } }))
      return rows
    })
    return NextResponse.json({ data: { category: created } }, { status: 201 })
  } catch (error) {
    const duplicate = error instanceof Error && /unique|duplicate/i.test(error.message)
    return NextResponse.json({ error: { code: duplicate ? 'CATEGORY_EXISTS' : 'CATEGORY_CREATE_FAILED', message: duplicate ? 'A category with this name already exists.' : error instanceof Error ? error.message : 'The category could not be created.' } }, { status: duplicate ? 409 : 400 })
  }
}
