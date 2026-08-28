import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { designs, storageAssets } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { createPresignedDownloadUrl } from '@/lib/storage/r2'

/** Serves only the authenticated owner's generated design preview. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: { message: 'Sign in to view this design preview.' } }, { status: 401 })
  const { id } = await context.params
  const [design] = await db.select().from(designs).where(eq(designs.id, id)).limit(1)
  const assetId = request.nextUrl.searchParams.get('side') === 'back' ? design?.backPreviewAssetId : design?.frontPreviewAssetId
  if (!design || design.userId !== session.user.id || !assetId) return NextResponse.json({ error: { message: 'Design preview not found.' } }, { status: 404 })
  const [asset] = await db.select().from(storageAssets).where(eq(storageAssets.id, assetId)).limit(1)
  if (!asset) return NextResponse.json({ error: { message: 'Design preview is unavailable.' } }, { status: 404 })
  return NextResponse.redirect(await createPresignedDownloadUrl(asset.objectKey))
}
