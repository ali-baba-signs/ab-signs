import { NextRequest, NextResponse } from 'next/server'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, productCategories, products, productSizes, storageAssets, templates } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateTemplateInput, type TemplateInput } from '@/lib/templates/validation'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'
import { safeErrorMessage } from '@/lib/api/safe-error'

export async function resolveTemplateProduct(input: TemplateInput) {
  const [product] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1)
  if (!product || !product.active) throw new Error('Select an active product for this template.')
  if (product.categoryId !== input.categoryId) throw new Error('The selected product does not belong to the selected category.')
  const sizes = await db.select().from(productSizes).where(eq(productSizes.productId, product.id)).orderBy(asc(productSizes.order))
  const enabledSizes = sizes.filter((size) => size.enabled && Number(size.width) > 0 && Number(size.height) > 0)
  if (!enabledSizes.length) throw new Error('Configure at least one enabled product size before creating a template.')
  const baseSize = enabledSizes.find((size) => size.isDefault) || enabledSizes[0]
  if (baseSize.unit !== input.unit || Math.abs(Number(baseSize.width) - Number(input.width)) > 0.001 || Math.abs(Number(baseSize.height) - Number(input.height)) > 0.001) throw new Error('The template canvas must use the product default size.')
  return { product, sizes: enabledSizes, baseSize }
}

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const [rows, categories, productRows, sizes] = await Promise.all([
      db.select().from(templates).orderBy(desc(templates.updatedAt)),
      db.select({ id: productCategories.id, name: productCategories.name, slug: productCategories.slug }).from(productCategories).orderBy(asc(productCategories.displayOrder), asc(productCategories.name)),
      db.select({ id: products.id, name: products.name, categoryId: products.categoryId, active: products.active }).from(products).orderBy(asc(products.name)),
      db.select().from(productSizes).orderBy(asc(productSizes.order)),
    ])
    const productsWithSizes = productRows.map((product) => ({ ...product, sizes: sizes.filter((size) => size.productId === product.id) }))
    return NextResponse.json({ data: { templates: rows.map((row) => { const product = productsWithSizes.find((item) => item.id === row.productId); const category = categories.find((item) => item.id === product?.categoryId); return { ...row, categoryId: product?.categoryId || null, categoryName: category?.name || null, productName: product?.name || null, sizes: product?.sizes || [] } }), categories, products: productsWithSizes } }, { headers: { 'cache-control': 'no-store' } })
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
    const { product, baseSize } = await resolveTemplateProduct(input)
    if (!input.assets.previewImage || !input.assets.svg) throw new Error('Upload both a preview image and an SVG template source.')
    const assetRows = await db.select().from(storageAssets).where(inArray(storageAssets.id, [input.assets.previewImage.id, input.assets.svg.id]))
    const preview = assetRows.find((asset) => asset.id === input.assets.previewImage!.id)
    const svg = assetRows.find((asset) => asset.id === input.assets.svg!.id)
    if (!preview?.contentType.startsWith('image/') || preview.contentType === 'image/svg+xml') throw new Error('Template preview must be a WEBP, PNG, or JPEG image.')
    if (svg?.contentType !== 'image/svg+xml') throw new Error('Editable template source must be an SVG file.')
    if (!input.svgChecksum || svg.etag !== input.svgChecksum) throw new Error('The generated data checksum does not match the uploaded sanitized SVG.')
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx.insert(templates).values({
        productId: product.id, name: input.name, description: input.description, category: null, status: input.status,
        canvasData: input.canvasData!, thumbnail: getStoredAssetUrl(preview.objectKey), previewImageUrl: getStoredAssetUrl(preview.objectKey), previewImageKey: preview.objectKey, previewAssetId: preview.id,
        svgUrl: getStoredAssetUrl(svg.objectKey), svgKey: svg.objectKey, svgAssetId: svg.id,
        physicalWidth: baseSize.width, physicalHeight: baseSize.height, measurementUnit: baseSize.unit,
        logicalCanvasWidth: input.logicalCanvasWidth, logicalCanvasHeight: input.logicalCanvasHeight, scaleMetadata: input.scaleMetadata,
        templateVersion: 1, svgChecksum: input.svgChecksum, conversionVersion: input.conversionVersion, conversionStatus: 'ready', conversionError: null, generatedAt: new Date(),
      }).returning()
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'template.created', entityType: 'template', entityId: rows[0].id, entityName: rows[0].name, description: `Created SVG editable template ${rows[0].name} for ${product.name}.`, metadata: { productId: product.id, categoryId: product.categoryId } }))
      return rows
    })
    return NextResponse.json({ data: { template: created } }, { status: 201 })
  } catch (error) {
    console.error('Template create failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATE_CREATE_FAILED', message: safeErrorMessage(error, 'The template could not be created. Verify its assets and product, then retry.', /Template|SVG|preview|Fabric|size|product|category|artwork|measurement|checksum/) } }, { status: 400 })
  }
}
