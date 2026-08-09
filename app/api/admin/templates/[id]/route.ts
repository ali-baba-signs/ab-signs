import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, products, productTemplateSizePrices, storageAssets, templates, templateSizes } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateTemplateInput } from '@/lib/templates/validation'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'
import { deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { safeErrorMessage } from '@/lib/api/safe-error'

function currentAssets(template: typeof templates.$inferSelect) {
  return {
    previewImage: template.previewImageKey && template.previewAssetId ? { id: template.previewAssetId, key: template.previewImageKey, url: template.previewImageUrl ?? undefined } : null,
    svg: template.svgKey && template.svgAssetId ? { id: template.svgAssetId, key: template.svgKey, url: template.svgUrl ?? undefined } : null,
  }
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  const [template] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
  if (!template) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Template not found.' } }, { status: 404 })
  const sizes = await db.select().from(templateSizes).where(eq(templateSizes.templateId, id))
  return NextResponse.json({ data: { template: { ...template, sizes } } })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  try {
    const [existing] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
    if (!existing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Template not found.' } }, { status: 404 })
    const input = validateTemplateInput(await request.json(), false)
    const old = currentAssets(existing)
    const merged = { previewImage: input.assets.previewImage === undefined ? old.previewImage : input.assets.previewImage, svg: input.assets.svg === undefined ? old.svg : input.assets.svg }
    if (!merged.previewImage || !merged.svg) throw new Error('Preserve or upload both the preview image and SVG source.')
    const svgChanged = merged.svg.key !== old.svg?.key
    const requiresGeneration = svgChanged || input.regenerate || existing.svgChecksum !== input.svgChecksum || existing.conversionVersion !== input.conversionVersion
    if (requiresGeneration && !input.canvasData) throw new Error('The changed SVG or conversion version requires regenerated Fabric data.')
    const canvasData = requiresGeneration ? input.canvasData! : existing.canvasData as Record<string, unknown>
    const assets = await db.select().from(storageAssets).where(inArray(storageAssets.id, [merged.previewImage.id, merged.svg.id]))
    const preview = assets.find((asset) => asset.id === merged.previewImage!.id)
    const svg = assets.find((asset) => asset.id === merged.svg!.id)
    if (!preview?.contentType.startsWith('image/') || preview.contentType === 'image/svg+xml' || svg?.contentType !== 'image/svg+xml') throw new Error('Template asset types are invalid.')
    if (requiresGeneration && (!input.svgChecksum || svg.etag !== input.svgChecksum)) throw new Error('The generated data checksum does not match the uploaded sanitized SVG.')
    const removedKeys = [old.previewImage, old.svg].flatMap((asset) => asset && ![merged.previewImage!.key, merged.svg!.key].includes(asset.key) ? [asset.key] : [])
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(templates).set({
        name: input.name, description: input.description, category: input.category, status: input.status, canvasData,
        thumbnail: getStoredAssetUrl(preview.objectKey), previewImageUrl: getStoredAssetUrl(preview.objectKey), previewImageKey: preview.objectKey, previewAssetId: preview.id,
        svgUrl: getStoredAssetUrl(svg.objectKey), svgKey: svg.objectKey, svgAssetId: svg.id,
        physicalWidth: input.width, physicalHeight: input.height, measurementUnit: input.unit,
        logicalCanvasWidth: input.logicalCanvasWidth, logicalCanvasHeight: input.logicalCanvasHeight,
        scaleMetadata: requiresGeneration ? input.scaleMetadata : existing.scaleMetadata,
        templateVersion: (existing.templateVersion || 1) + (requiresGeneration ? 1 : 0),
        svgChecksum: requiresGeneration ? input.svgChecksum : existing.svgChecksum,
        conversionVersion: input.conversionVersion,
        conversionStatus: 'ready', conversionError: null, generatedAt: requiresGeneration ? new Date() : existing.generatedAt,
        updatedAt: new Date(),
      }).where(eq(templates.id, id)).returning()
      const existingSizes = await tx.select().from(templateSizes).where(eq(templateSizes.templateId, id))
      await tx.update(templateSizes).set({ isDefault: false }).where(eq(templateSizes.templateId, id))
      const retained = new Set<string>()
      const savedSizes: Array<{ id: string }> = []
      for (const size of input.sizes) {
        if (size.id && existingSizes.some((row) => row.id === size.id)) {
          const [saved] = await tx.update(templateSizes).set({ label: size.label, width: size.width, height: size.height, unit: size.unit, fitMode: size.fitMode, safeMargin: size.safeMargin, bleed: size.bleed, trimMarks: size.trimMarks, enabled: size.enabled, isDefault: size.isDefault, displayOrder: size.displayOrder, updatedAt: new Date() }).where(eq(templateSizes.id, size.id)).returning({ id: templateSizes.id })
          retained.add(saved.id); savedSizes.push(saved)
        } else {
          const [saved] = await tx.insert(templateSizes).values({ templateId: id, label: size.label, width: size.width, height: size.height, unit: size.unit, fitMode: size.fitMode, safeMargin: size.safeMargin, bleed: size.bleed, trimMarks: size.trimMarks, enabled: size.enabled, isDefault: size.isDefault, displayOrder: size.displayOrder }).returning({ id: templateSizes.id })
          retained.add(saved.id); savedSizes.push(saved)
        }
      }
      for (const oldSize of existingSizes) if (!retained.has(oldSize.id)) await tx.delete(templateSizes).where(eq(templateSizes.id, oldSize.id))
      const associatedProducts = await tx.select({ id: products.id, basePrice: products.basePrice }).from(products).where(eq(products.templateId, id))
      for (const product of associatedProducts) await tx.insert(productTemplateSizePrices).values(savedSizes.map((size) => ({ productId: product.id, templateSizeId: size.id, unitPrice: product.basePrice }))).onConflictDoNothing()
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: requiresGeneration ? 'template.regenerated' : 'template.updated', entityType: 'template', entityId: id, entityName: input.name, description: `${requiresGeneration ? 'Regenerated' : 'Updated'} SVG editable template ${input.name}.`, metadata: { regenerated: requiresGeneration, version: rows[0].templateVersion } }))
      return rows
    })
    await Promise.allSettled(removedKeys.map(deleteAssetIfOrphaned))
    return NextResponse.json({ data: { template: updated } })
  } catch (error) {
    console.error('Template update failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATE_UPDATE_FAILED', message: safeErrorMessage(error, 'The template could not be updated. Verify its assets and production sizes, then retry.', /Template|SVG|preview|Fabric|size|artwork|measurement|label|margin|bleed|checksum|Preserve|regenerated/) } }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  const [existing] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
  if (!existing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Template not found.' } }, { status: 404 })
  const associated = await db.select({ id: products.id }).from(products).where(eq(products.templateId, id)).limit(1)
  if (associated.length) return NextResponse.json({ error: { code: 'TEMPLATE_IN_USE', message: 'Remove this template from its associated products before deleting it.' } }, { status: 409 })
  await db.transaction(async (tx) => {
    await tx.delete(templates).where(eq(templates.id, id))
    await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'template.deleted', entityType: 'template', entityId: id, entityName: existing.name, description: `Deleted editable template ${existing.name}.` }))
  })
  await Promise.allSettled([existing.previewImageKey, existing.svgKey].filter((key): key is string => Boolean(key)).map(deleteAssetIfOrphaned))
  return NextResponse.json({ data: { deleted: id } })
}
