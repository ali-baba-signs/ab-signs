import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, productImages, products, productSizes, templateProducts, templates } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateProductInput } from '@/lib/products/validation'
import { getProductsWithDetails } from '@/lib/products/queries'
import { deleteAssetIfOrphaned } from '@/lib/storage/asset-records'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'
import { validateTemplateSideAssignments } from '@/lib/products/template-assignments'
import { productWriteErrorMessage } from '@/lib/products/write-errors'

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  const [product] = await getProductsWithDetails(id, true)
  return product ? NextResponse.json({ data: { product } }) : NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Product not found.' } }, { status: 404 })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  let input: ReturnType<typeof validateProductInput> | undefined
  try {
    const [existingProduct] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    if (!existingProduct) throw new Error('Product not found.')
    const raw = await request.json() as Record<string, unknown>
    input = validateProductInput({ ...raw, sku: existingProduct.sku })
    const referencedTemplateIds = [...new Set(input.sizes.flatMap((size) => size.designConfigurations.flatMap((configuration) => [configuration.singleTemplateId, configuration.frontTemplateId, configuration.backTemplateId].filter((templateId): templateId is string => Boolean(templateId)))))]
    if (referencedTemplateIds.length) {
      const ready = await db.select({ id: templates.id, templateSide: templates.templateSide, status: templates.status, conversionStatus: templates.conversionStatus }).from(templates).where(inArray(templates.id, referencedTemplateIds))
      if (ready.length !== referencedTemplateIds.length || ready.some((template) => template.status !== 'active' || template.conversionStatus !== 'ready')) throw new Error('One or more assigned templates are unavailable or not ready.')
      validateTemplateSideAssignments(input.sizes, ready)
    }
    const oldImages = await db.select().from(productImages).where(eq(productImages.productId, id))
    const existingIds = new Set(oldImages.map((image) => image.id))
    if (input.images.some((image) => image.id && !existingIds.has(image.id))) throw new Error('An existing image does not belong to this product.')
    const keptImageIds = input.images.flatMap((image) => image.id ? [image.id] : [])
    const removedImages = oldImages.filter((image) => !keptImageIds.includes(image.id))
    await db.transaction(async (tx) => {
      const [product] = await tx.update(products).set({
        sku: existingProduct.sku, name: input!.name, description: input!.description, basePrice: input!.basePrice.toFixed(2), categoryId: input!.categoryId,
        templateId: input!.templateId, designMode: input!.designMode, sizeMode: input!.sizeMode, allowCustomDimensions: input!.allowCustomDimensions, freeShipping: input!.freeShipping, featured: input!.featured, active: input!.active, updatedAt: new Date(),
      }).where(eq(products.id, id)).returning()
      if (!product) throw new Error('Product not found.')
      if (removedImages.length) await tx.delete(productImages).where(inArray(productImages.id, removedImages.map((image) => image.id)))
      for (const image of input!.images) {
        if (image.id) await tx.update(productImages).set({ alt: image.alt, isPrimary: image.isPrimary, order: image.order }).where(and(eq(productImages.id, image.id), eq(productImages.productId, id)))
        else await tx.insert(productImages).values({ productId: id, url: getStoredAssetUrl(image.key!), storageKey: image.key, assetId: image.assetId, alt: image.alt, isPrimary: image.isPrimary, order: image.order })
      }
      const existingSizes = await tx.select().from(productSizes).where(eq(productSizes.productId, id))
      const retained = new Set<string>()
      for (const size of input!.sizes) {
        if (size.id && existingSizes.some((row) => row.id === size.id)) {
          await tx.update(productSizes).set({ label: size.label, width: size.width, height: size.height, unit: size.unit, unitPrice: size.unitPrice.toFixed(2), enabled: size.enabled, order: size.order, variantType: size.variantType, sizeGroup: size.sizeGroup, sideMode: size.sideMode, assembledHeightDescription:size.assembledHeightDescription, fitMode:size.fitMode, safeMargin:size.safeMargin, bleed:size.bleed, trimMarks:size.trimMarks, isDefault:size.isDefault, frontTemplateId:size.frontTemplateId, backTemplateId:size.backTemplateId, designConfigurations:size.designConfigurations, updatedAt: new Date() }).where(eq(productSizes.id, size.id))
          retained.add(size.id)
        } else {
          const [created] = await tx.insert(productSizes).values({ productId: id, label: size.label, width: size.width, height: size.height, unit: size.unit, unitPrice: size.unitPrice.toFixed(2), enabled: size.enabled, order: size.order, variantType: size.variantType, sizeGroup: size.sizeGroup, sideMode: size.sideMode, assembledHeightDescription:size.assembledHeightDescription, fitMode:size.fitMode, safeMargin:size.safeMargin, bleed:size.bleed, trimMarks:size.trimMarks, isDefault:size.isDefault, frontTemplateId:size.frontTemplateId, backTemplateId:size.backTemplateId, designConfigurations:size.designConfigurations }).returning({ id: productSizes.id })
          retained.add(created.id)
        }
      }
      for (const size of existingSizes) if (!retained.has(size.id)) await tx.delete(productSizes).where(eq(productSizes.id, size.id))
      if (referencedTemplateIds.length) await tx.insert(templateProducts).values(referencedTemplateIds.map((templateId) => ({ templateId, productId: id }))).onConflictDoNothing()
      await tx.insert(adminActivityLogs).values(activityValues(session, {
        actionType: 'product.updated', entityType: 'product', entityId: id, entityName: input!.name,
        description: `Updated product ${input!.name}.`, metadata: { sku: existingProduct.sku, removedImages: removedImages.length, imageCount: input!.images.length, productSizeCount: input!.sizes.length },
      }))
    })
    await Promise.allSettled(removedImages.flatMap((image) => image.storageKey ? [deleteAssetIfOrphaned(image.storageKey)] : []))
    return NextResponse.json({ data: { product: (await getProductsWithDetails(id, true))[0] } })
  } catch (error) {
    console.error('Product update failed', error)
    const message = productWriteErrorMessage(error, 'updated')
    return NextResponse.json({ error: { code: 'PRODUCT_UPDATE_FAILED', message } }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const { id } = await context.params
  try {
    const oldImages = await db.select().from(productImages).where(eq(productImages.productId, id))
    const [deleted] = await db.transaction(async (tx) => {
      const rows = await tx.delete(products).where(eq(products.id, id)).returning()
      if (!rows[0]) throw new Error('Product not found.')
      await tx.insert(adminActivityLogs).values(activityValues(session, {
        actionType: 'product.deleted', entityType: 'product', entityId: id, entityName: rows[0].name,
        description: `Deleted product ${rows[0].name}.`, metadata: { sku: rows[0].sku, imageCount: oldImages.length },
      }))
      return rows
    })
    await Promise.allSettled(oldImages.flatMap((image) => image.storageKey ? [deleteAssetIfOrphaned(image.storageKey)] : []))
    return NextResponse.json({ data: { deleted: deleted.id } })
  } catch (error) {
    console.error('Product delete failed', error)
    return NextResponse.json({ error: { code: 'PRODUCT_DELETE_FAILED', message: error instanceof Error && error.message.includes('not found') ? error.message : 'The product could not be deleted. It may be referenced by an existing order.' } }, { status: 409 })
  }
}
