import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, productCategories, products, storageAssets } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { safeErrorMessage } from '@/lib/api/safe-error'

function nameOf(value: unknown) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 120) : '' }
function slugify(value: string) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) }

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(); if (!session) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  try {
    const [existing] = await db.select().from(productCategories).where(eq(productCategories.id, id)).limit(1)
    if (!existing) return NextResponse.json({ error: { message: 'Category not found.' } }, { status: 404 })
    const [oldAsset] = existing.imageAssetId ? await db.select().from(storageAssets).where(eq(storageAssets.id, existing.imageAssetId)).limit(1) : []
    const body = await request.json() as Record<string, unknown>; const name = nameOf(body.name); const slug = slugify(name)
    if (name.length < 2 || !slug) throw new Error('Category name must contain at least two letters or numbers.')
    const [duplicate] = await db.select().from(productCategories).where(sql`lower(${productCategories.name}) = lower(${name}) and ${productCategories.id} <> ${id}::uuid`).limit(1)
    if (duplicate) return NextResponse.json({ error: { message: 'A category with this name already exists.' } }, { status: 409 })
    const imageAssetId = typeof body.imageAssetId === 'string' && body.imageAssetId ? body.imageAssetId : null
    if (imageAssetId) { const [asset] = await db.select().from(storageAssets).where(sql`${storageAssets.id} = ${imageAssetId}::uuid`).limit(1); if (!asset || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.contentType)) throw new Error('Select a valid PNG, JPG, or WebP category image.') }
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(productCategories).set({ name, slug, description: typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : '', imageAssetId, enabled: body.enabled !== false, showOnHomepage: body.showOnHomepage === true, displayOrder: Math.max(0, Math.floor(Number(body.displayOrder) || 0)), updatedAt: new Date() }).where(eq(productCategories.id, id)).returning()
      if (!rows[0]) throw new Error('Category not found.')
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'category.updated', entityType: 'product_category', entityId: id, entityName: name, description: `Updated product category ${name}.` }))
      return rows
    })
    if (oldAsset?.objectKey && oldAsset.id !== imageAssetId) await deleteAssetIfOrphaned(oldAsset.objectKey)
    return NextResponse.json({ data: { category: updated } })
  } catch (error) { console.error('Category update failed', { categoryId: id, error }); return NextResponse.json({ error: { message: safeErrorMessage(error, 'The category could not be updated. Check its values and try again.', /Category name|valid category image|not found/) } }, { status: 400 }) }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession(); if (!session) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  const [category] = await db.select().from(productCategories).where(eq(productCategories.id, id)).limit(1)
  if (!category) return NextResponse.json({ error: { message: 'Category not found.' } }, { status: 404 })
  if ((await db.select({ id: products.id }).from(products).where(eq(products.categoryId, id)).limit(1)).length) return NextResponse.json({ error: { message: 'This category is still used by products. Disable it instead.' } }, { status: 409 })
  await db.transaction(async (tx) => { await tx.delete(productCategories).where(eq(productCategories.id, id)); await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'category.deleted', entityType: 'product_category', entityId: id, entityName: category.name, description: `Deleted product category ${category.name}.` })) })
  if (category.imageAssetId) { const [asset] = await db.select().from(storageAssets).where(eq(storageAssets.id, category.imageAssetId)).limit(1); if (asset) await deleteAssetIfOrphaned(asset.objectKey) }
  return NextResponse.json({ data: { deleted: id } })
}
