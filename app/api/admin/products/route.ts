import { NextRequest, NextResponse } from 'next/server'
import { asc, eq, inArray, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, productCategories, productImages, products, productSizes, templateProducts, templates } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateProductInput } from '@/lib/products/validation'
import { getProductsWithDetails } from '@/lib/products/queries'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'
import { nextProductSku, productSkuPrefix } from '@/lib/products/sku'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const [productRows, categories, templateRows] = await Promise.all([
      getProductsWithDetails(undefined, true),
      db.select().from(productCategories).orderBy(asc(productCategories.name)),
      db.select({ id: templates.id, name: templates.name, status: templates.status, conversionStatus: templates.conversionStatus }).from(templates).orderBy(asc(templates.name)),
    ])
    return NextResponse.json({ data: { products: productRows, categories, templates: templateRows } })
  } catch (error) {
    console.error('Admin products load failed', error)
    return NextResponse.json({ error: { code: 'PRODUCTS_LOAD_FAILED', message: 'Products could not be loaded. Apply the latest database migration and try again.' } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  let input: ReturnType<typeof validateProductInput> | undefined
  let autoSkuPrefix: string | null = null
  try {
    const raw = await request.json() as Record<string, unknown>
    // Keep manually supplied SKUs intact, while making every new product
    // printable/traceable even when an admin leaves the field blank.
    if (typeof raw.sku !== 'string' || !raw.sku.trim()) {
      const categoryId = typeof raw.categoryId === 'string' ? raw.categoryId : ''
      const [category] = categoryId ? await db.select({ name: productCategories.name }).from(productCategories).where(eq(productCategories.id, categoryId)).limit(1) : []
      autoSkuPrefix = productSkuPrefix(category?.name || 'Product', typeof raw.name === 'string' ? raw.name : 'Item')
      raw.sku = `${autoSkuPrefix}-0000`
    }
    input = validateProductInput(raw)
    const referencedTemplateIds = [...new Set(input.sizes.flatMap((size) => [size.frontTemplateId, size.backTemplateId].filter((id): id is string => Boolean(id))))]
    if (referencedTemplateIds.length) {
      const ready = await db.select({ id: templates.id }).from(templates).where(inArray(templates.id, referencedTemplateIds))
      if (ready.length !== referencedTemplateIds.length) throw new Error('One or more assigned templates no longer exist.')
    }
    const result = await db.transaction(async (tx) => {
      let resolvedSku = input!.sku
      if (autoSkuPrefix) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${autoSkuPrefix}))`)
        const existing = await tx.select({ sku: products.sku }).from(products).where(like(products.sku, `${autoSkuPrefix}-%`))
        resolvedSku = nextProductSku(autoSkuPrefix, existing.map((row) => row.sku))
      }
      const [product] = await tx.insert(products).values({
        sku: resolvedSku, name: input!.name, description: input!.description, basePrice: input!.basePrice.toFixed(2),
        categoryId: input!.categoryId, templateId: input!.templateId, sizeMode: input!.sizeMode, allowCustomDimensions: input!.allowCustomDimensions, freeShipping: input!.freeShipping, featured: input!.featured, active: input!.active,
      }).returning()
      await tx.insert(productImages).values(input!.images.map((image) => ({
        productId: product.id, url: image.key ? getStoredAssetUrl(image.key) : image.url!, storageKey: image.key, assetId: image.assetId, alt: image.alt, isPrimary: image.isPrimary, order: image.order,
      })))
      const standalone = input!.sizes.length ? input!.sizes : [{ label: 'Standard', width: null, height: null, unit: 'mm', unitPrice: input!.basePrice, enabled: true, order: 0, assembledHeightDescription:null, fitMode:'contain' as const, safeMargin:'0', bleed:'3', trimMarks:true, isDefault:true, frontTemplateId:null, backTemplateId:null }]
      await tx.insert(productSizes).values(standalone.map((size) => ({ productId: product.id, label: size.label, width: size.width, height: size.height, unit: size.unit, unitPrice: size.unitPrice.toFixed(2), enabled: size.enabled, order: size.order, variantType: 'variantType' in size ? size.variantType : null, sizeGroup: 'sizeGroup' in size ? size.sizeGroup : null, sideMode: 'sideMode' in size ? size.sideMode : 'single', assembledHeightDescription:size.assembledHeightDescription, fitMode: size.fitMode, safeMargin: size.safeMargin, bleed: size.bleed, trimMarks: size.trimMarks, isDefault: size.isDefault, frontTemplateId:size.frontTemplateId, backTemplateId:size.backTemplateId })))
      if (referencedTemplateIds.length) await tx.insert(templateProducts).values(referencedTemplateIds.map((templateId) => ({ templateId, productId: product.id }))).onConflictDoNothing()
      await tx.insert(adminActivityLogs).values(activityValues(session, {
        actionType: 'product.created', entityType: 'product', entityId: product.id, entityName: product.name,
        description: `Created product ${product.name}.`, metadata: { sku: product.sku, imageCount: input!.images.length, productSizeCount: standalone.length },
      }))
      return product
    })
    return NextResponse.json({ data: { product: result } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && /required|must|valid|select|add|enable|SKU/i.test(error.message) ? error.message : 'The product could not be created. Confirm the SKU is unique and try again.'
    console.error('Product create failed', error)
    return NextResponse.json({ error: { code: 'PRODUCT_CREATE_FAILED', message } }, { status: 400 })
  }
}
