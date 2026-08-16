import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { designs, designVersions, productSizes, products, templateSizes } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { registerStorageAsset, deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { uploadObject } from '@/lib/storage/r2'
import { createUploadKey } from '@/lib/storage/upload-validation'
import { R2_PATHS } from '@/lib/storage/r2-paths'
import { renderProductionDesign } from '@/lib/production/design-render'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const unitToMm: Record<string, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8, m: 1000 }

async function persistRenderedAsset(ownerId: string, groupId: string, filename: string, contentType: string, body: Buffer) {
  const key = `${R2_PATHS.designUploads}/${ownerId.replace(/[^a-zA-Z0-9_-]/g, '')}/${groupId}/${crypto.randomUUID()}-${filename}`
  await uploadObject({ key, body, contentType, metadata: { ownerId, private: 'true', generated: 'true' } })
  return registerStorageAsset({ key, contentType, size: body.length, etag: createHash('sha256').update(body).digest('hex') })
}

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
    const variantId = typeof input.variantId === 'string' && uuid.test(input.variantId) ? input.variantId : typeof input.sizeId === 'string' && uuid.test(input.sizeId) ? input.sizeId : null
    if (!productId || !templateId || !variantId) throw new Error('Choose a valid product, template, and production variant before saving the design.')
    // `variantId` is the authoritative selected product size. Template-size products
    // are explicitly validated against their template; fixed variants against product.
    const [[product], [templateSize], [productSize]] = await Promise.all([
      db.select().from(products).where(eq(products.id, productId)).limit(1),
      db.select().from(templateSizes).where(eq(templateSizes.id, variantId)).limit(1),
      db.select().from(productSizes).where(and(eq(productSizes.id, variantId), eq(productSizes.productId, productId))).limit(1),
    ])
    if (!product?.active) throw new Error('The selected product is unavailable.')
    const size = product.sizeMode === 'template_sizes' ? templateSize?.templateId === templateId && templateSize.enabled ? templateSize : null : productSize?.enabled ? productSize : null
    if (!size || (product.templateId !== templateId && !('frontTemplateId' in size && (size.frontTemplateId === templateId || size.backTemplateId === templateId)))) throw new Error('The selected production variant is not available for this template.')
    const body = Buffer.from(JSON.stringify({ ...(design as Record<string, unknown>), variantId }))
    if (body.length > 10 * 1024 * 1024) throw new Error('The design is too large to save in the browser editor.')

    const [existing] = id ? await db.select().from(designs).where(eq(designs.id, id)).limit(1) : []
    if (id && (!existing || existing.userId !== session.user.id)) return NextResponse.json({ error: { message: 'Design not found or access denied.' } }, { status: 404 })
    const key = createUploadKey({ filename: 'design-draft.json', contentType: 'application/json', size: body.length, purpose: 'design-draft', designId: id || undefined }, session.user.id)
    await uploadObject({ key, body, contentType: 'application/json', metadata: { ownerId: session.user.id, private: 'true' } })
    const asset = await registerStorageAsset({ key, contentType: 'application/json', size: body.length, etag: createHash('sha256').update(body).digest('hex') })
    const canvasData = { ...(design as Record<string, unknown>), assetKey: key, assetId: asset.id, variantId }
    const oldKey = existing && existing.assetId ? (existing.canvasData as Record<string, unknown>)?.assetKey : null

    const factor = unitToMm[String(size.unit)] || 1
    const renderOptions = { widthMm: Number(size.width) * factor, heightMm: Number(size.height) * factor, bleedMm: Number('bleed' in size ? size.bleed : 3), trimMarks: 'trimMarks' in size ? Boolean(size.trimMarks) : true }
    const sideMode = String((design as Record<string, unknown>).productConfig && ((design as Record<string, unknown>).productConfig as Record<string, unknown>).sideMode || ('sideMode' in size ? size.sideMode : 'single'))
    const front = await renderProductionDesign(canvasData, { ...renderOptions, side: 'front' })
    const groupId = id || crypto.randomUUID()
    const [frontPreview, production, backPreview] = await Promise.all([
      persistRenderedAsset(session.user.id, groupId, 'front-preview.png', 'image/png', front.preview),
      persistRenderedAsset(session.user.id, groupId, 'front-production.pdf', 'application/pdf', front.pdf),
      sideMode === 'double'
        ? renderProductionDesign(canvasData, { ...renderOptions, side: 'back' }).then((back) => persistRenderedAsset(session.user.id, groupId, 'back-preview.png', 'image/png', back.preview))
        : Promise.resolve(null),
    ])

    const saved = await db.transaction(async (tx) => {
      if (existing) {
        const [latest] = await tx.select({ version: designVersions.version }).from(designVersions).where(eq(designVersions.designId, existing.id)).orderBy(desc(designVersions.version)).limit(1)
        await tx.insert(designVersions).values({ designId: existing.id, version: (latest?.version || 0) + 1, canvasData })
        const [row] = await tx.update(designs).set({ canvasData, assetId: asset.id, previewAssetId: frontPreview.id, frontPreviewAssetId: frontPreview.id, backPreviewAssetId: backPreview?.id || null, productionAssetId: production.id, thumbnail: frontPreview.objectKey, templateId, productId, updatedAt: new Date() }).where(eq(designs.id, existing.id)).returning()
        return row
      }
      const [row] = await tx.insert(designs).values({ userId: session.user.id, name: typeof input.name === 'string' ? input.name.trim().slice(0, 255) || 'Untitled design' : 'Untitled design', canvasData, assetId: asset.id, previewAssetId: frontPreview.id, frontPreviewAssetId: frontPreview.id, backPreviewAssetId: backPreview?.id || null, productionAssetId: production.id, thumbnail: frontPreview.objectKey, templateId, productId, isPublic: false }).returning()
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
