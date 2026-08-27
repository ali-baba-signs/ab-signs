import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { designs, designVersions, productSizes, products, templateProducts, templates } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { registerStorageAsset, deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { getObjectBody, getObjectMetadata, uploadObject } from '@/lib/storage/r2'
import { createUploadKey } from '@/lib/storage/upload-validation'
import { R2_PATHS } from '@/lib/storage/r2-paths'
import { isTemplateCompatibleWithSize } from '@/lib/templates/compatibility'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const unitToMm: Record<string, number> = { mm: 1, cm: 10, in: 25.4, ft: 304.8, m: 1000 }

type UploadedRender = {
  key: string
  contentType: 'image/png'
  size: number
  pixelWidth: number
  pixelHeight: number
}

type ProductionContentType = 'application/pdf' | 'image/svg+xml'
type UploadedProduction = { key: string; contentType: ProductionContentType; size: number; pixelWidth: number; pixelHeight: number; metadata?: Record<string, unknown> }

function uploadedRender(value: unknown): UploadedRender {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const result = {
    key: typeof row.key === 'string' ? row.key : '',
    contentType: row.contentType,
    size: Number(row.size),
    pixelWidth: Number(row.pixelWidth),
    pixelHeight: Number(row.pixelHeight),
  }
  if (!result.key || result.contentType !== 'image/png' || !Number.isInteger(result.size) || result.size <= 0 || result.size > 20 * 1024 * 1024) {
    throw new Error('The browser preview is missing or invalid.')
  }
  if (!Number.isInteger(result.pixelWidth) || !Number.isInteger(result.pixelHeight) || result.pixelWidth < 100 || result.pixelHeight < 100 || result.pixelWidth > 10000 || result.pixelHeight > 10000) {
    throw new Error('The browser render dimensions are invalid.')
  }
  return result as UploadedRender
}

async function verifyUploadedRender(render: UploadedRender, ownerId: string) {
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!render.key.startsWith(`${R2_PATHS.designPreviews}/${safeOwner}/`)) throw new Error('The generated design asset does not belong to this account.')
  const metadata = await getObjectMetadata(render.key)
  if (metadata.ContentType !== render.contentType || Number(metadata.ContentLength) !== render.size) throw new Error('The generated design asset changed during upload.')
  return metadata
}

async function acceptPreview(render: UploadedRender, ownerId: string) {
  const metadata = await verifyUploadedRender(render, ownerId)
  return registerStorageAsset({
    key: render.key,
    contentType: render.contentType,
    size: render.size,
    uploadedAt: metadata.LastModified,
    etag: metadata.ETag?.replace(/^"|"$/g, '') || null,
  })
}

function uploadedProduction(value: unknown, expectedType: ProductionContentType): UploadedProduction {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const result = { key: typeof row.key === 'string' ? row.key : '', contentType: row.contentType, size: Number(row.size), pixelWidth: Number(row.pixelWidth), pixelHeight: Number(row.pixelHeight), metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : undefined }
  if (!result.key || result.contentType !== expectedType || !Number.isInteger(result.size) || result.size <= 100 || result.size > 100 * 1024 * 1024) throw new Error(`The production ${expectedType === 'application/pdf' ? 'PDF' : 'SVG'} is missing or invalid.`)
  return result as UploadedProduction
}

async function acceptProduction(render: UploadedProduction, ownerId: string) {
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!render.key.startsWith(`${R2_PATHS.printFiles}/${safeOwner}/`)) throw new Error('The production PDF does not belong to this account.')
  const metadata = await getObjectMetadata(render.key)
  if (metadata.ContentType !== render.contentType || Number(metadata.ContentLength) !== render.size) throw new Error('The production file changed during upload.')
  const body = await getObjectBody(render.key)
  const isValid = render.contentType === 'application/pdf' ? body.subarray(0, 5).equals(Buffer.from('%PDF-')) : /^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!DOCTYPE[\s\S]*?>\s*)?<svg\b/i.test(body.subarray(0, 2048).toString('utf8').trim())
  if (body.length !== render.size || !isValid) throw new Error(`The production file is not a real ${render.contentType === 'application/pdf' ? 'PDF' : 'SVG'}.`)
  return registerStorageAsset({ key: render.key, contentType: render.contentType, size: render.size, uploadedAt: metadata.LastModified, etag: metadata.ETag?.replace(/^"|"$/g, '') || null })
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
    const productionInput = input.production && typeof input.production === 'object' ? input.production as Record<string, unknown> : {}
    const frontInput = uploadedRender(previewInput.front)
    const frontProductionFiles = productionInput.front && typeof productionInput.front === 'object' ? productionInput.front as Record<string, unknown> : {}
    const frontProductionInput = uploadedProduction(frontProductionFiles.pdf ?? productionInput.front, 'application/pdf')
    const frontSvgInput = uploadedProduction(frontProductionFiles.svg, 'image/svg+xml')
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
    const widthMm = Number(size.width) * factor
    const heightMm = Number(size.height) * factor
    const sideMode = size.sideMode
    const backInput = sideMode === 'double' ? uploadedRender(previewInput.back) : null
    const backProductionFiles = productionInput.back && typeof productionInput.back === 'object' ? productionInput.back as Record<string, unknown> : {}
    const backProductionInput = sideMode === 'double' ? uploadedProduction(backProductionFiles.pdf ?? productionInput.back, 'application/pdf') : null
    const backSvgInput = sideMode === 'double' ? uploadedProduction(backProductionFiles.svg, 'image/svg+xml') : null
    const [front, back, frontProduction, backProduction, frontSvg, backSvg] = await Promise.all([
      acceptPreview(frontInput, session.user.id),
      backInput ? acceptPreview(backInput, session.user.id) : Promise.resolve(null),
      acceptProduction(frontProductionInput, session.user.id),
      backProductionInput ? acceptProduction(backProductionInput, session.user.id) : Promise.resolve(null),
      acceptProduction(frontSvgInput, session.user.id),
      backSvgInput ? acceptProduction(backSvgInput, session.user.id) : Promise.resolve(null),
    ])

    const key = createUploadKey({ filename: 'design-draft.json', contentType: 'application/json', size: body.length, purpose: 'design-draft', designId: id || undefined }, session.user.id)
    await uploadObject({ key, body, contentType: 'application/json', metadata: { ownerId: session.user.id, private: 'true' } })
    const asset = await registerStorageAsset({ key, contentType: 'application/json', size: body.length, etag: createHash('sha256').update(body).digest('hex') })
    const canvasData = {
      ...(design as Record<string, unknown>),
      assetKey: key,
      assetId: asset.id,
      variantId,
      product: {
        id: productId,
        category: template.templateKind,
        categoryId: product.categoryId,
        sizeId: variantId,
        widthMm,
        heightMm,
        sideMode,
      },
      templateReference: templateId,
      previewUrl: `/api/designs/${id || 'pending'}/preview`,
      renderedAssets: {
        front: { previewKey: front.objectKey, productionKey: frontProduction.objectKey, pdfProductionKey: frontProduction.objectKey, svgProductionKey: frontSvg.objectKey, metadata: frontProductionInput.metadata || {} },
        ...(back ? { back: { previewKey: back.objectKey, productionKey: backProduction?.objectKey, pdfProductionKey: backProduction?.objectKey, svgProductionKey: backSvg?.objectKey, metadata: backProductionInput?.metadata || {} } } : {}),
      },
    }
    const oldKey = existing && existing.assetId ? (existing.canvasData as Record<string, unknown>)?.assetKey : null

    const saved = await db.transaction(async (tx) => {
      if (existing) {
        const [latest] = await tx.select({ version: designVersions.version }).from(designVersions).where(eq(designVersions.designId, existing.id)).orderBy(desc(designVersions.version)).limit(1)
        const finalCanvasData = { ...canvasData, designId: existing.id, previewUrl: `/api/designs/${existing.id}/preview` }
        await tx.insert(designVersions).values({ designId: existing.id, version: (latest?.version || 0) + 1, canvasData: finalCanvasData })
        const [row] = await tx.update(designs).set({ canvasData: finalCanvasData, assetId: asset.id, previewAssetId: front.id, frontPreviewAssetId: front.id, backPreviewAssetId: back?.id || null, productionAssetId: frontProduction.id, thumbnail: front.objectKey, templateId, productId, updatedAt: new Date() }).where(eq(designs.id, existing.id)).returning()
        return row
      }
      const [row] = await tx.insert(designs).values({ userId: session.user.id, name: typeof input.name === 'string' ? input.name.trim().slice(0, 255) || 'Untitled design' : 'Untitled design', canvasData, assetId: asset.id, previewAssetId: front.id, frontPreviewAssetId: front.id, backPreviewAssetId: back?.id || null, productionAssetId: frontProduction.id, thumbnail: front.objectKey, templateId, productId, isPublic: false }).returning()
      const finalCanvasData = { ...canvasData, designId: row.id, previewUrl: `/api/designs/${row.id}/preview` }
      await tx.update(designs).set({ canvasData: finalCanvasData }).where(eq(designs.id, row.id))
      await tx.insert(designVersions).values({ designId: row.id, version: 1, canvasData: finalCanvasData })
      return { ...row, canvasData: finalCanvasData }
    })
    if (typeof oldKey === 'string' && oldKey !== key) await deleteAssetIfOrphaned(oldKey)
    return NextResponse.json({ data: { design: saved } }, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error('Private design save failed', error)
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'The private design could not be saved.' } }, { status: 400 })
  }
}
