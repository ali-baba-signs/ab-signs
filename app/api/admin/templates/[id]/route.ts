import { NextRequest, NextResponse } from 'next/server'
import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, productCategories, products, productSizes, storageAssets, templates } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateTemplateInput, type TemplateInput } from '@/lib/templates/validation'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'
import { deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { safeErrorMessage } from '@/lib/api/safe-error'

function currentAssets(template: typeof templates.$inferSelect) {
  return {
    previewImage: template.previewImageKey && template.previewAssetId ? { id: template.previewAssetId, key: template.previewImageKey, url: template.previewImageUrl ?? undefined } : null,
    svg: template.svgKey && template.svgAssetId ? { id: template.svgAssetId, key: template.svgKey, url: template.svgUrl ?? undefined } : null,
  }
}

async function resolveProduct(input: TemplateInput) {
  const [product] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1)
  if (!product || !product.active) throw new Error('Select an active product for this template.')
  if (product.categoryId !== input.categoryId) throw new Error('The selected product does not belong to the selected category.')
  const sizes = await db.select().from(productSizes).where(eq(productSizes.productId, product.id)).orderBy(asc(productSizes.order))
  const enabledSizes = sizes.filter((size) => size.enabled && Number(size.width) > 0 && Number(size.height) > 0)
  if (!enabledSizes.length) throw new Error('Configure at least one enabled product size before updating a template.')
  const baseSize = enabledSizes.find((size) => size.isDefault) || enabledSizes[0]
  if (baseSize.unit !== input.unit || Math.abs(Number(baseSize.width) - Number(input.width)) > 0.001 || Math.abs(Number(baseSize.height) - Number(input.height)) > 0.001) throw new Error('The template canvas must use the product default size.')
  return { product, sizes: enabledSizes, baseSize }
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  const [template] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
  if (!template) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Template not found.' } }, { status: 404 })
  const [product] = template.productId ? await db.select().from(products).where(eq(products.id, template.productId)).limit(1) : []
  const [category] = product ? await db.select().from(productCategories).where(eq(productCategories.id, product.categoryId)).limit(1) : []
  const sizes = product ? await db.select().from(productSizes).where(eq(productSizes.productId, product.id)).orderBy(asc(productSizes.order)) : []
  return NextResponse.json({ data: { template: { ...template, categoryId: category?.id || null, categoryName: category?.name || null, productName: product?.name || null, sizes } } })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  try {
    const [existing] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
    if (!existing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Template not found.' } }, { status: 404 })
    const input = validateTemplateInput(await request.json(), false)
    const { product, baseSize } = await resolveProduct(input)
    const old = currentAssets(existing)
    const merged = { previewImage: input.assets.previewImage === undefined ? old.previewImage : input.assets.previewImage, svg: input.assets.svg === undefined ? old.svg : input.assets.svg }
    if (!merged.previewImage || !merged.svg) throw new Error('Preserve or upload both the preview image and SVG source.')
    const svgChanged = merged.svg.key !== old.svg?.key
    const requiresGeneration = svgChanged || input.regenerate || existing.svgChecksum !== input.svgChecksum || existing.conversionVersion !== input.conversionVersion || existing.physicalWidth !== baseSize.width || existing.physicalHeight !== baseSize.height || existing.measurementUnit !== baseSize.unit
    if (requiresGeneration && !input.canvasData) throw new Error('The changed SVG, product size, or conversion version requires regenerated Fabric data.')
    const canvasData = requiresGeneration ? input.canvasData! : existing.canvasData as Record<string, unknown>
    const assets = await db.select().from(storageAssets).where(inArray(storageAssets.id, [merged.previewImage.id, merged.svg.id]))
    const preview = assets.find((asset) => asset.id === merged.previewImage!.id)
    const svg = assets.find((asset) => asset.id === merged.svg!.id)
    if (!preview?.contentType.startsWith('image/') || preview.contentType === 'image/svg+xml' || svg?.contentType !== 'image/svg+xml') throw new Error('Template asset types are invalid.')
    if (requiresGeneration && (!input.svgChecksum || svg.etag !== input.svgChecksum)) throw new Error('The generated data checksum does not match the uploaded sanitized SVG.')
    const removedKeys = [old.previewImage, old.svg].flatMap((asset) => asset && ![merged.previewImage!.key, merged.svg!.key].includes(asset.key) ? [asset.key] : [])
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(templates).set({
        productId: product.id, name: input.name, description: input.description, category: null, status: input.status, canvasData,
        thumbnail: getStoredAssetUrl(preview.objectKey), previewImageUrl: getStoredAssetUrl(preview.objectKey), previewImageKey: preview.objectKey, previewAssetId: preview.id,
        svgUrl: getStoredAssetUrl(svg.objectKey), svgKey: svg.objectKey, svgAssetId: svg.id,
        physicalWidth: baseSize.width, physicalHeight: baseSize.height, measurementUnit: baseSize.unit,
        logicalCanvasWidth: input.logicalCanvasWidth, logicalCanvasHeight: input.logicalCanvasHeight,
        scaleMetadata: requiresGeneration ? input.scaleMetadata : existing.scaleMetadata, templateVersion: (existing.templateVersion || 1) + (requiresGeneration ? 1 : 0),
        svgChecksum: requiresGeneration ? input.svgChecksum : existing.svgChecksum, conversionVersion: input.conversionVersion,
        conversionStatus: 'ready', conversionError: null, generatedAt: requiresGeneration ? new Date() : existing.generatedAt, updatedAt: new Date(),
      }).where(eq(templates.id, id)).returning()
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: requiresGeneration ? 'template.regenerated' : 'template.updated', entityType: 'template', entityId: id, entityName: input.name, description: `${requiresGeneration ? 'Regenerated' : 'Updated'} SVG editable template ${input.name} for ${product.name}.`, metadata: { productId: product.id, categoryId: product.categoryId, regenerated: requiresGeneration, version: rows[0].templateVersion } }))
      return rows
    })
    await Promise.allSettled(removedKeys.map(deleteAssetIfOrphaned))
    return NextResponse.json({ data: { template: updated } })
  } catch (error) {
    console.error('Template update failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATE_UPDATE_FAILED', message: safeErrorMessage(error, 'The template could not be updated. Verify its assets and product, then retry.', /Template|SVG|preview|Fabric|size|product|category|artwork|measurement|checksum|Preserve|regenerated/) } }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  const [existing] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
  if (!existing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Template not found.' } }, { status: 404 })
  const associated = await db.select({ id: products.id }).from(products).where(eq(products.templateId, id)).limit(1)
  if (associated.length) return NextResponse.json({ error: { code: 'TEMPLATE_IN_USE', message: 'This legacy default template is still referenced by a product.' } }, { status: 409 })
  await db.transaction(async (tx) => {
    await tx.delete(templates).where(eq(templates.id, id))
    await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'template.deleted', entityType: 'template', entityId: id, entityName: existing.name, description: `Deleted editable template ${existing.name}.` }))
  })
  await Promise.allSettled([existing.previewImageKey, existing.svgKey].filter((key): key is string => Boolean(key)).map(deleteAssetIfOrphaned))
  return NextResponse.json({ data: { deleted: id } })
}
