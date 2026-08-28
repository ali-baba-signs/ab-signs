import { NextRequest, NextResponse } from 'next/server'
import { asc, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, productCategories, products, productSizes, storageAssets, templateProducts, templates } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateTemplateInput } from '@/lib/templates/validation'
import { resolveTemplateProducts } from '@/lib/templates/product-selection'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'
import { safeErrorMessage } from '@/lib/api/safe-error'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const [rows, categories, productRows, sizes, links] = await Promise.all([
      db.select().from(templates).orderBy(desc(templates.updatedAt)),
      db.select({ id: productCategories.id, name: productCategories.name, slug: productCategories.slug }).from(productCategories).orderBy(asc(productCategories.displayOrder), asc(productCategories.name)),
      db.select({ id: products.id, name: products.name, categoryId: products.categoryId, active: products.active }).from(products).orderBy(asc(products.name)),
      db.select().from(productSizes).orderBy(asc(productSizes.order)),
      db.select().from(templateProducts),
    ])
    const productsWithSizes = productRows.map((product) => ({ ...product, sizes: sizes.filter((size) => size.productId === product.id) }))
    return NextResponse.json({ data: { templates: rows.map((row) => { const productIds = links.filter((link) => link.templateId === row.id).map((link) => link.productId); const assigned = productsWithSizes.filter((item) => productIds.includes(item.id)); const category = categories.find((item) => item.id === assigned[0]?.categoryId); return { ...row, productIds, categoryId: assigned[0]?.categoryId || null, categoryName: category?.name || null, productName: assigned.map((item) => item.name).join(', ') || null, products: assigned, sizes: assigned[0]?.sizes || [] } }), categories, products: productsWithSizes } }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('Template list failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATES_LOAD_FAILED', message: 'Templates could not be loaded. Apply the latest database migration and try again.' } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const input = validateTemplateInput(await request.json())
    const { products: selectedProducts, primaryProduct, baseSize } = await resolveTemplateProducts(input)
    if (!input.assets.previewImage || !input.assets.editableSvg) throw new Error('Upload both a preview image and an editable artwork SVG.')
    if (input.templateKind === 'flag' && !input.assets.fixedSvg) throw new Error('Flag templates require a fixed shape SVG.')
    const assetIds = [input.assets.previewImage.id, input.assets.editableSvg.id, input.assets.fixedSvg?.id].filter((id): id is string => Boolean(id))
    const assetRows = await db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds))
    const preview = assetRows.find((asset) => asset.id === input.assets.previewImage!.id)
    const svg = assetRows.find((asset) => asset.id === input.assets.editableSvg!.id)
    const fixedSvg = input.assets.fixedSvg ? assetRows.find((asset) => asset.id === input.assets.fixedSvg!.id) : null
    if (!preview?.contentType.startsWith('image/') || preview.contentType === 'image/svg+xml') throw new Error('Template preview must be a WEBP, PNG, or JPEG image.')
    if (svg?.contentType !== 'image/svg+xml') throw new Error('Editable template source must be an SVG file.')
    if (fixedSvg && fixedSvg.contentType !== 'image/svg+xml') throw new Error('Fixed product shape must be an SVG file.')
    if (!input.svgChecksum || svg.etag !== input.svgChecksum) throw new Error('The generated data checksum does not match the uploaded sanitized SVG.')
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx.insert(templates).values({
        productId: primaryProduct.id, name: input.name, description: input.description, category: null, status: input.status,
        canvasData: input.canvasData!, fixedCanvasData: input.fixedCanvasData, templateKind: input.templateKind, templateSide: input.templateSide, printableArea: input.printableArea,
        thumbnail: getStoredAssetUrl(preview.objectKey), previewImageUrl: getStoredAssetUrl(preview.objectKey), previewImageKey: preview.objectKey, previewAssetId: preview.id,
        svgUrl: getStoredAssetUrl(svg.objectKey), svgKey: svg.objectKey, svgAssetId: svg.id,
        fixedSvgUrl: fixedSvg ? getStoredAssetUrl(fixedSvg.objectKey) : null, fixedSvgKey: fixedSvg?.objectKey || null, fixedSvgAssetId: fixedSvg?.id || null,
        physicalWidth: baseSize.width, physicalHeight: baseSize.height, measurementUnit: baseSize.unit,
        logicalCanvasWidth: input.logicalCanvasWidth, logicalCanvasHeight: input.logicalCanvasHeight, scaleMetadata: input.scaleMetadata,
        templateVersion: 1, svgChecksum: input.svgChecksum, conversionVersion: input.conversionVersion, conversionStatus: 'ready', conversionError: null, generatedAt: new Date(),
      }).returning()
      await tx.insert(templateProducts).values(selectedProducts.map((product) => ({ templateId: rows[0].id, productId: product.id })))
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'template.created', entityType: 'template', entityId: rows[0].id, entityName: rows[0].name, description: `Created ${input.templateSide} SVG editable template ${rows[0].name} for ${selectedProducts.length} product(s).`, metadata: { productIds: input.productIds, categoryId: input.categoryId, templateSide: input.templateSide } }))
      return rows
    })
    return NextResponse.json({ data: { template: created } }, { status: 201 })
  } catch (error) {
    console.error('Template create failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATE_CREATE_FAILED', message: safeErrorMessage(error, 'The template could not be created. Verify its assets and product, then retry.', /Template|SVG|preview|Fabric|size|product|category|artwork|measurement|checksum/) } }, { status: 400 })
  }
}
