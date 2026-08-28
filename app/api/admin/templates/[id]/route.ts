import { NextRequest, NextResponse } from 'next/server'
import { asc, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, designs, orderItems, productCategories, products, productSizes, storageAssets, templateProducts, templates } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateTemplateInput } from '@/lib/templates/validation'
import { resolveTemplateProducts } from '@/lib/templates/product-selection'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'
import { deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { safeErrorMessage } from '@/lib/api/safe-error'
import { designConfigurationsForSize } from '@/lib/products/design-configurations'

function currentAssets(template: typeof templates.$inferSelect) {
  return {
    previewImage: template.previewImageKey && template.previewAssetId ? { id: template.previewAssetId, key: template.previewImageKey, url: template.previewImageUrl ?? undefined } : null,
    editableSvg: template.svgKey && template.svgAssetId ? { id: template.svgAssetId, key: template.svgKey, url: template.svgUrl ?? undefined } : null,
    fixedSvg: template.fixedSvgKey && template.fixedSvgAssetId ? { id: template.fixedSvgAssetId, key: template.fixedSvgKey, url: template.fixedSvgUrl ?? undefined } : null,
  }
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  const [template] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
  if (!template) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Template not found.' } }, { status: 404 })
  const links = await db.select().from(templateProducts).where(eq(templateProducts.templateId, id))
  const productRows = links.length ? await db.select().from(products).where(inArray(products.id, links.map((link) => link.productId))) : []
  const [category] = productRows[0] ? await db.select().from(productCategories).where(eq(productCategories.id, productRows[0].categoryId)).limit(1) : []
  const sizes = productRows.length ? await db.select().from(productSizes).where(inArray(productSizes.productId, productRows.map((product) => product.id))).orderBy(asc(productSizes.order)) : []
  return NextResponse.json({ data: { template: { ...template, productIds: links.map((link) => link.productId), products: productRows.map((product) => ({ ...product, sizes: sizes.filter((size) => size.productId === product.id) })), categoryId: category?.id || null, categoryName: category?.name || null, productName: productRows.map((product) => product.name).join(', ') || null, sizes: sizes.filter((size) => size.productId === productRows[0]?.id) } } })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  try {
    const [existing] = await db.select().from(templates).where(eq(templates.id, id)).limit(1)
    if (!existing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Template not found.' } }, { status: 404 })
    const input = validateTemplateInput(await request.json(), false)
    const { products: selectedProducts, primaryProduct, baseSize } = await resolveTemplateProducts(input)
    const configurationReference = sql<boolean>`exists (select 1 from jsonb_array_elements(coalesce(${productSizes.designConfigurations}::jsonb, '[]'::jsonb)) configuration where configuration->>'singleTemplateId' = ${id} or configuration->>'frontTemplateId' = ${id} or configuration->>'backTemplateId' = ${id})`
    const assignedSizes = await db.select({
      productId: productSizes.productId,
      label: productSizes.label,
      sideMode: productSizes.sideMode,
      frontTemplateId: productSizes.frontTemplateId,
      backTemplateId: productSizes.backTemplateId,
      designConfigurations: productSizes.designConfigurations,
    }).from(productSizes).where(or(eq(productSizes.frontTemplateId, id), eq(productSizes.backTemplateId, id), configurationReference))
    for (const size of assignedSizes) {
      if (!input.productIds.includes(size.productId)) throw new Error(`${size.label} still uses this template. Keep its product selected or update the product size first.`)
      for (const configuration of designConfigurationsForSize(size)) {
        const expected = configuration.singleTemplateId === id ? 'single' : configuration.frontTemplateId === id ? 'front' : configuration.backTemplateId === id ? 'back' : null
        if (expected && input.templateSide !== expected) throw new Error(`${size.label} uses this as its ${expected} template. Update the size design configuration before changing the template side.`)
      }
    }
    const old = currentAssets(existing)
    const merged = {
      previewImage: input.assets.previewImage === undefined ? old.previewImage : input.assets.previewImage,
      editableSvg: input.assets.editableSvg === undefined ? old.editableSvg : input.assets.editableSvg,
      fixedSvg: input.assets.fixedSvg === undefined ? old.fixedSvg : input.assets.fixedSvg,
    }
    if (!merged.previewImage || !merged.editableSvg) throw new Error('Preserve or upload both the preview image and editable SVG source.')
    if (input.templateKind === 'flag' && !merged.fixedSvg) throw new Error('Flag templates require a fixed shape SVG.')
    const svgChanged = merged.editableSvg.key !== old.editableSvg?.key || merged.fixedSvg?.key !== old.fixedSvg?.key
    const requiresGeneration = svgChanged || input.regenerate || existing.svgChecksum !== input.svgChecksum || existing.conversionVersion !== input.conversionVersion
    if (requiresGeneration && !input.canvasData) throw new Error('The changed SVG, product size, or conversion version requires regenerated Fabric data.')
    const canvasData = requiresGeneration ? input.canvasData! : existing.canvasData as Record<string, unknown>
    const assetIds = [merged.previewImage.id, merged.editableSvg.id, merged.fixedSvg?.id].filter((assetId): assetId is string => Boolean(assetId))
    const assets = await db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds))
    const preview = assets.find((asset) => asset.id === merged.previewImage!.id)
    const svg = assets.find((asset) => asset.id === merged.editableSvg!.id)
    const fixedSvg = merged.fixedSvg ? assets.find((asset) => asset.id === merged.fixedSvg!.id) : null
    if (!preview?.contentType.startsWith('image/') || preview.contentType === 'image/svg+xml' || svg?.contentType !== 'image/svg+xml' || (fixedSvg && fixedSvg.contentType !== 'image/svg+xml')) throw new Error('Template asset types are invalid.')
    if (requiresGeneration && (!input.svgChecksum || svg.etag !== input.svgChecksum)) throw new Error('The generated data checksum does not match the uploaded sanitized SVG.')
    const retainedKeys = [merged.previewImage.key, merged.editableSvg.key, merged.fixedSvg?.key].filter(Boolean)
    const removedKeys = [old.previewImage, old.editableSvg, old.fixedSvg].flatMap((asset) => asset && !retainedKeys.includes(asset.key) ? [asset.key] : [])
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(templates).set({
        productId: primaryProduct.id, name: input.name, description: input.description, category: null, status: input.status, canvasData,
        fixedCanvasData: requiresGeneration ? input.fixedCanvasData : existing.fixedCanvasData,
        templateKind: input.templateKind, templateSide: input.templateSide, printableArea: input.printableArea,
        thumbnail: getStoredAssetUrl(preview.objectKey), previewImageUrl: getStoredAssetUrl(preview.objectKey), previewImageKey: preview.objectKey, previewAssetId: preview.id,
        svgUrl: getStoredAssetUrl(svg.objectKey), svgKey: svg.objectKey, svgAssetId: svg.id,
        fixedSvgUrl: fixedSvg ? getStoredAssetUrl(fixedSvg.objectKey) : null, fixedSvgKey: fixedSvg?.objectKey || null, fixedSvgAssetId: fixedSvg?.id || null,
        physicalWidth: requiresGeneration ? baseSize.width : existing.physicalWidth, physicalHeight: requiresGeneration ? baseSize.height : existing.physicalHeight, measurementUnit: requiresGeneration ? baseSize.unit : existing.measurementUnit,
        logicalCanvasWidth: requiresGeneration ? input.logicalCanvasWidth : existing.logicalCanvasWidth, logicalCanvasHeight: requiresGeneration ? input.logicalCanvasHeight : existing.logicalCanvasHeight,
        scaleMetadata: requiresGeneration ? input.scaleMetadata : existing.scaleMetadata, templateVersion: (existing.templateVersion || 1) + (requiresGeneration ? 1 : 0),
        svgChecksum: requiresGeneration ? input.svgChecksum : existing.svgChecksum, conversionVersion: input.conversionVersion,
        conversionStatus: 'ready', conversionError: null, generatedAt: requiresGeneration ? new Date() : existing.generatedAt, updatedAt: new Date(),
      }).where(eq(templates.id, id)).returning()
      await tx.delete(templateProducts).where(eq(templateProducts.templateId, id))
      await tx.insert(templateProducts).values(selectedProducts.map((product) => ({ templateId: id, productId: product.id })))
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: requiresGeneration ? 'template.regenerated' : 'template.updated', entityType: 'template', entityId: id, entityName: input.name, description: `${requiresGeneration ? 'Regenerated' : 'Updated'} SVG editable template ${input.name} for ${selectedProducts.length} product(s).`, metadata: { productIds: input.productIds, categoryId: input.categoryId, regenerated: requiresGeneration, version: rows[0].templateVersion } }))
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
  const configurationReference = sql<boolean>`exists (select 1 from jsonb_array_elements(coalesce(${productSizes.designConfigurations}::jsonb, '[]'::jsonb)) configuration where configuration->>'singleTemplateId' = ${id} or configuration->>'frontTemplateId' = ${id} or configuration->>'backTemplateId' = ${id})`
  const [associated, sizeReference, designReference, orderReference] = await Promise.all([
    db.select({ id: products.id }).from(products).where(eq(products.templateId, id)).limit(1),
    db.select({ id: productSizes.id }).from(productSizes).where(or(eq(productSizes.frontTemplateId, id), eq(productSizes.backTemplateId, id), configurationReference)).limit(1),
    db.select({ id: designs.id }).from(designs).where(eq(designs.templateId, id)).limit(1),
    db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.templateId, id)).limit(1),
  ])
  if (sizeReference.length) return NextResponse.json({ error: { code: 'TEMPLATE_IN_USE', message: 'This template is assigned to a product size. Update that size before deleting the template.' } }, { status: 409 })
  if (designReference.length || orderReference.length) {
    const [archived] = await db.transaction(async (tx) => {
      const rows = await tx.update(templates).set({ status: 'inactive', updatedAt: new Date() }).where(eq(templates.id, id)).returning()
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'template.archived', entityType: 'template', entityId: id, entityName: existing.name, description: `Archived editable template ${existing.name} because it is referenced by saved designs or orders.` }))
      return rows
    })
    return NextResponse.json({ data: { deleted: false, archived: true, template: archived } })
  }
  if (associated.length) return NextResponse.json({ error: { code: 'TEMPLATE_IN_USE', message: 'This legacy default template is still referenced by a product.' } }, { status: 409 })
  await db.transaction(async (tx) => {
    await tx.delete(templates).where(eq(templates.id, id))
    await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'template.deleted', entityType: 'template', entityId: id, entityName: existing.name, description: `Deleted editable template ${existing.name}.` }))
  })
  await Promise.allSettled([existing.previewImageKey, existing.svgKey, existing.fixedSvgKey].filter((key): key is string => Boolean(key)).map(deleteAssetIfOrphaned))
  return NextResponse.json({ data: { deleted: id } })
}
