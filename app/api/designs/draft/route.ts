import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { designs, designVersions } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { registerStorageAsset, deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { uploadObject } from '@/lib/storage/r2'
import { createUploadKey } from '@/lib/storage/upload-validation'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: { message: 'Sign in to save a private design.' } }, { status: 401 })
  try {
    const input = await request.json() as Record<string, unknown>
    const id = typeof input.id === 'string' && uuid.test(input.id) ? input.id : null
    const productId = typeof input.productId === 'string' && uuid.test(input.productId) ? input.productId : null
    const templateId = typeof input.templateId === 'string' && uuid.test(input.templateId) ? input.templateId : null
    const design = input.design
    if (!design || typeof design !== 'object') throw new Error('Design data is missing.')
    const body = Buffer.from(JSON.stringify({ ...(design as Record<string, unknown>), productSizeId: input.sizeId || null }))
    if (body.length > 10 * 1024 * 1024) throw new Error('The design is too large to save in the browser editor.')

    const [existing] = id ? await db.select().from(designs).where(eq(designs.id, id)).limit(1) : []
    if (id && (!existing || existing.userId !== session.user.id)) return NextResponse.json({ error: { message: 'Design not found or access denied.' } }, { status: 404 })
    const key = createUploadKey({ filename: 'design-draft.json', contentType: 'application/json', size: body.length, purpose: 'design-draft', designId: id || undefined }, session.user.id)
    await uploadObject({ key, body, contentType: 'application/json', metadata: { ownerId: session.user.id, private: 'true' } })
    const asset = await registerStorageAsset({ key, contentType: 'application/json', size: body.length, etag: createHash('sha256').update(body).digest('hex') })
    const canvasData = { ...(design as Record<string, unknown>), assetKey: key, assetId: asset.id, productSizeId: input.sizeId || null }
    const oldKey = existing && existing.assetId ? (existing.canvasData as Record<string, unknown>)?.assetKey : null

    const saved = await db.transaction(async (tx) => {
      if (existing) {
        const [latest] = await tx.select({ version: designVersions.version }).from(designVersions).where(eq(designVersions.designId, existing.id)).orderBy(desc(designVersions.version)).limit(1)
        await tx.insert(designVersions).values({ designId: existing.id, version: (latest?.version || 0) + 1, canvasData })
        const [row] = await tx.update(designs).set({ canvasData, assetId: asset.id, templateId, productId, updatedAt: new Date() }).where(eq(designs.id, existing.id)).returning()
        return row
      }
      const [row] = await tx.insert(designs).values({ userId: session.user.id, name: typeof input.name === 'string' ? input.name.trim().slice(0, 255) || 'Untitled design' : 'Untitled design', canvasData, assetId: asset.id, templateId, productId, isPublic: false }).returning()
      await tx.insert(designVersions).values({ designId: row.id, version: 1, canvasData })
      return row
    })
    if (typeof oldKey === 'string' && oldKey !== key) await deleteAssetIfOrphaned(oldKey)
    return NextResponse.json({ data: { design: saved } }, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error('Private design save failed', error)
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'The private design could not be saved.' } }, { status: 400 })
  }
}
