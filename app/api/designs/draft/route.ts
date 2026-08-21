import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { designs, designVersions, productSizes, products, templateProducts, templates } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { registerStorageAsset, deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { deleteObject, getObjectBody, getObjectMetadata, uploadObject } from '@/lib/storage/r2'
import { createUploadKey } from '@/lib/storage/upload-validation'
import { R2_PATHS } from '@/lib/storage/r2-paths'
import { renderProductionJpeg } from '@/lib/production/design-render'
import { isTemplateCompatibleWithSize } from '@/lib/templates/compatibility'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const unitToMm: Record<string, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8, m: 1000 }

type UploadedRender = {
  key: string
  contentType: 'image/png' | 'image/jpeg'
  size: number
  pixelWidth: number
  pixelHeight: number
}
type SideRender = { preview: UploadedRender; production: UploadedRender }

async function persistRenderedAsset(ownerId: string, groupId: string, filename: string, contentType: string, body: Buffer) {
  const key = `${R2_PATHS.designUploads}/${ownerId.replace(/[^a-zA-Z0-9_-]/g, '')}/${groupId}/${crypto.randomUUID()}-${filename}`
  await uploadObject({ key, body, contentType, metadata: { ownerId, private: 'true', generated: 'true' } })
  return registerStorageAsset({ key, contentType, size: body.length, etag: createHash('sha256').update(body).digest('hex') })
}

function uploadedRender(value: unknown, contentType: UploadedRender['contentType']): UploadedRender {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const result = {
    key: typeof row.key === 'string' ? row.key : '',
    contentType: row.contentType,
    size: Number(row.size),
    pixelWidth: Number(row.pixelWidth),
    pixelHeight: Number(row.pixelHeight),
  }
  if (!result.key || result.contentType !== contentType || !Number.isInteger(result.size) || result.size <= 0 || result.size > 20 * 1024 * 1024) {
    throw new Error(`The browser ${contentType === 'image/png' ? 'preview' : 'production render'} is missing or invalid.`)
  }
  if (!Number.isInteger(result.pixelWidth) || !Number.isInteger(result.pixelHeight) || result.pixelWidth < 100 || result.pixelHeight < 100 || result.pixelWidth > 10000 || result.pixelHeight > 10000) {
    throw new Error('The browser render dimensions are invalid.')
  }
  return result as UploadedRender
}

function sideRender(value: unknown): SideRender {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return { preview: uploadedRender(row.preview, 'image/png'), production: uploadedRender(row.production, 'image/jpeg') }
}

async function verifyUploadedRender(render: UploadedRender, ownerId: string) {
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!render.key.startsWith(`${R2_PATHS.designPreviews}/${safeOwner}/`)) throw new Error('The generated design asset does not belong to this account.')
  const metadata = await getObjectMetadata(render.key)
  if (metadata.ContentType !== render.contentType || Number(metadata.ContentLength) !== render.size) throw new Error('The generated design asset changed during upload.')
  return metadata
}

async function acceptSideRender(
  render: SideRender,
  ownerId: string,
  groupId: string,
  side: 'front' | 'back',
  options: { widthMm: number; heightMm: number; bleedMm: number; trimMarks: boolean },
) {
  const [previewMetadata, productionMetadata] = await Promise.all([
    verifyUploadedRender(render.preview, ownerId),
    verifyUploadedRender(render.production, ownerId),
  ])
  const preview = await registerStorageAsset({
    key: render.preview.key,
    contentType: render.preview.contentType,
    size: render.preview.size,
    uploadedAt: previewMetadata.LastModified,
    etag: previewMetadata.ETag?.replace(/^"|"$/g, '') || null,
  })
  try {
    const jpeg = await getObjectBody(render.production.key)
    const output = renderProductionJpeg(jpeg, options)
    const production = await persistRenderedAsset(ownerId, groupId, `${side}-production.pdf`, 'application/pdf', output.pdf)
    return { preview, production, metadata: output.metadata }
  } finally {
    await deleteObject(render.production.key).catch(() => undefined)
  }
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
    const previewInput = input.previews && typeof input.previews === 'object' ? input.previews as Record<string, unknown> : {}
    const frontInput = sideRender(previewInput.front)
    const variantId = typeof input.variantId === 'string' && uuid.test(input.variantId) ? input.variantId : typeof input.sizeId === 'string' && uuid.test(input.sizeId) ? input.sizeId : null
    if (!productId || !templateId || !variantId) throw new Error('Choose a valid product, template, and production variant before saving the design.')

    const [[product], [template], [productSize], [templateLink]] = await Promise.all([
      db.select().from(products).where(eq(products.id, productId)).limit(1),
      db.select().from(templates).where(eq(templates.id, templateId)).limit(1),
      db.select().from(productSizes).where(and(eq(productSizes.id, variantId), eq(productSizes.productId, productId))).limit(1),
      db.select().from(templateProducts).where(and(eq(templateProducts.templateId, templateId), eq(templateProducts.productId, productId))).limit(1),
    ])
    if (!product?.active) throw new Error('The selected product is unavailable.')
    if (!template || template.status !== 'active' || template.conversionStatus !== 'ready') throw new Error('The selected template is unavailable. Please choose another template.')
    if (!templateLink) throw new Error('This template is not compatible with the selected product. Please choose another template.')
    if (!productSize?.enabled) throw new Error('The selected size is unavailable. Please choose another size.')
    if (!isTemplateCompatibleWithSize(templateId, productSize)) throw new Error('This template is not available for the selected size. Please choose another size.')
    const size = productSize
    if (!(Number(size.width) > 0 && Number(size.height) > 0)) throw new Error('The selected size has no printable dimensions. Please choose another size.')

    const body = Buffer.from(JSON.stringify({ ...(design as Record<string, unknown>), variantId }))
    if (body.length > 10 * 1024 * 1024) throw new Error('The design is too large to save in the browser editor.')
    const [existing] = id ? await db.select().from(designs).where(eq(designs.id, id)).limit(1) : []
    if (id && (!existing || existing.userId !== session.user.id)) return NextResponse.json({ error: { message: 'Design not found or access denied.' } }, { status: 404 })

    const factor = unitToMm[String(size.unit)] || 1
    const renderOptions = { widthMm: Number(size.width) * factor, heightMm: Number(size.height) * factor, bleedMm: Number(size.bleed), trimMarks: Boolean(size.trimMarks) }
    const sideMode = size.sideMode
    const backInput = sideMode === 'double' ? sideRender(previewInput.back) : null
    const groupId = id || crypto.randomUUID()
    const [front, back] = await Promise.all([
      acceptSideRender(frontInput, session.user.id, groupId, 'front', renderOptions),
      backInput ? acceptSideRender(backInput, session.user.id, groupId, 'back', renderOptions) : Promise.resolve(null),
    ])

    const key = createUploadKey({ filename: 'design-draft.json', contentType: 'application/json', size: body.length, purpose: 'design-draft', designId: id || undefined }, session.user.id)
    await uploadObject({ key, body, contentType: 'application/json', metadata: { ownerId: session.user.id, private: 'true' } })
    const asset = await registerStorageAsset({ key, contentType: 'application/json', size: body.length, etag: createHash('sha256').update(body).digest('hex') })
    const canvasData = {
      ...(design as Record<string, unknown>),
      assetKey: key,
      assetId: asset.id,
      variantId,
      renderedAssets: {
        front: { previewKey: front.preview.objectKey, productionKey: front.production.objectKey, metadata: front.metadata },
        ...(back ? { back: { previewKey: back.preview.objectKey, productionKey: back.production.objectKey, metadata: back.metadata } } : {}),
      },
    }
    const oldKey = existing && existing.assetId ? (existing.canvasData as Record<string, unknown>)?.assetKey : null

    const saved = await db.transaction(async (tx) => {
      if (existing) {
        const [latest] = await tx.select({ version: designVersions.version }).from(designVersions).where(eq(designVersions.designId, existing.id)).orderBy(desc(designVersions.version)).limit(1)
        await tx.insert(designVersions).values({ designId: existing.id, version: (latest?.version || 0) + 1, canvasData })
        const [row] = await tx.update(designs).set({ canvasData, assetId: asset.id, previewAssetId: front.preview.id, frontPreviewAssetId: front.preview.id, backPreviewAssetId: back?.preview.id || null, productionAssetId: front.production.id, thumbnail: front.preview.objectKey, templateId, productId, updatedAt: new Date() }).where(eq(designs.id, existing.id)).returning()
        return row
      }
      const [row] = await tx.insert(designs).values({ userId: session.user.id, name: typeof input.name === 'string' ? input.name.trim().slice(0, 255) || 'Untitled design' : 'Untitled design', canvasData, assetId: asset.id, previewAssetId: front.preview.id, frontPreviewAssetId: front.preview.id, backPreviewAssetId: back?.preview.id || null, productionAssetId: front.production.id, thumbnail: front.preview.objectKey, templateId, productId, isPublic: false }).returning()
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
