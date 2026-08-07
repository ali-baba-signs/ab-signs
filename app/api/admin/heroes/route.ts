import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/client'
import { adminActivityLogs, heroSlides, storageAssets } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { getHeroSlides } from '@/lib/home/hero-data'
import { validateHeroInput } from '@/lib/home/hero-validation'

async function ensureImageAssets(ids: string[]) {
  const rows = await db.select().from(storageAssets).where(and(inArray(storageAssets.id, ids), eq(storageAssets.status, 'available')))
  if (rows.length !== new Set(ids).size || rows.some((asset) => !asset.contentType.startsWith('image/'))) throw new Error('Every hero image must be an available image asset.')
}

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  return NextResponse.json({ data: { heroes: await getHeroSlides() } }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const input = validateHeroInput(await request.json())
    await ensureImageAssets([input.desktopAssetId, input.mobileAssetId].filter((id): id is string => Boolean(id)))
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx.insert(heroSlides).values(input).returning()
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'hero.created', entityType: 'hero_slide', entityId: rows[0].id, entityName: input.title || input.altText, description: `Created homepage hero ${input.title || input.altText}.`, metadata: { featured: input.featured, enabled: input.enabled, displayOrder: input.displayOrder } }))
      return rows
    })
    revalidatePath('/')
    return NextResponse.json({ data: { hero: created } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: { code: 'HERO_CREATE_FAILED', message: error instanceof Error ? error.message : 'Hero slide could not be created.' } }, { status: 400 })
  }
}
