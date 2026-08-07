import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { adminActivityLogs, heroSlides, storageAssets } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateHeroInput } from '@/lib/home/hero-validation'
import { deleteAssetIfOrphaned } from '@/lib/storage/asset-records'

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  try {
    const [existing] = await db.select().from(heroSlides).where(eq(heroSlides.id, id)).limit(1)
    if (!existing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Hero slide not found.' } }, { status: 404 })
    const input = validateHeroInput(await request.json())
    const assetIds = [input.desktopAssetId, input.mobileAssetId].filter((value): value is string => Boolean(value))
    const assets = await db.select().from(storageAssets).where(and(inArray(storageAssets.id, assetIds), eq(storageAssets.status, 'available')))
    if (assets.length !== new Set(assetIds).size || assets.some((asset) => !asset.contentType.startsWith('image/'))) throw new Error('Every hero image must be an available image asset.')
    const actionType = input.displayOrder !== existing.displayOrder ? 'hero.reordered' : input.featured !== existing.featured ? (input.featured ? 'hero.featured' : 'hero.unfeatured') : input.enabled !== existing.enabled ? (input.enabled ? 'hero.enabled' : 'hero.disabled') : 'hero.updated'
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(heroSlides).set({ ...input, updatedAt: new Date() }).where(eq(heroSlides.id, id)).returning()
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType, entityType: 'hero_slide', entityId: id, entityName: input.title || input.altText, description: `${actionType.replace('.', ' ')}: ${input.title || input.altText}.`, metadata: { displayOrder: input.displayOrder, featured: input.featured, enabled: input.enabled } }))
      return rows
    })
    const replacedIds = [existing.desktopAssetId, existing.mobileAssetId].filter((assetId): assetId is string => assetId ? !assetIds.includes(assetId) : false)
    if (replacedIds.length) {
      const replaced = await db.select().from(storageAssets).where(inArray(storageAssets.id, replacedIds))
      await Promise.allSettled(replaced.map((asset) => deleteAssetIfOrphaned(asset.objectKey)))
    }
    revalidatePath('/')
    return NextResponse.json({ data: { hero: updated } })
  } catch (error) {
    return NextResponse.json({ error: { code: 'HERO_UPDATE_FAILED', message: error instanceof Error ? error.message : 'Hero slide could not be updated.' } }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  const [existing] = await db.select().from(heroSlides).where(eq(heroSlides.id, id)).limit(1)
  if (!existing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Hero slide not found.' } }, { status: 404 })
  await db.transaction(async (tx) => {
    await tx.delete(heroSlides).where(eq(heroSlides.id, id))
    await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'hero.deleted', entityType: 'hero_slide', entityId: id, entityName: existing.title || existing.altText, description: `Deleted homepage hero ${existing.title || existing.altText}.` }))
  })
  const oldAssets = await db.select().from(storageAssets).where(inArray(storageAssets.id, [existing.desktopAssetId, existing.mobileAssetId].filter((assetId): assetId is string => Boolean(assetId))))
  await Promise.allSettled(oldAssets.map((asset) => deleteAssetIfOrphaned(asset.objectKey)))
  revalidatePath('/')
  return NextResponse.json({ data: { deleted: id } })
}
