import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, productCategories, productImages, products, productSizes, productTemplateSizePrices, templates, templateSizes } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateProductInput } from '@/lib/products/validation'
import { getProductsWithDetails } from '@/lib/products/queries'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const [productRows, categories, templateRows, allTemplateSizes] = await Promise.all([
      getProductsWithDetails(undefined, true),
      db.select().from(productCategories).orderBy(asc(productCategories.name)),
      db.select().from(templates).orderBy(asc(templates.name)),
      db.select().from(templateSizes).orderBy(asc(templateSizes.displayOrder)),
    ])
    return NextResponse.json({ data: { products: productRows, categories, templates: templateRows.map((template) => ({ ...template, sizes: allTemplateSizes.filter((size) => size.templateId === template.id) })) } })
  } catch (error) {
    console.error('Admin products load failed', error)
    return NextResponse.json({ error: { code: 'PRODUCTS_LOAD_FAILED', message: 'Products could not be loaded. Apply the latest database migration and try again.' } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  let input: ReturnType<typeof validateProductInput> | undefined
  try {
    input = validateProductInput(await request.json())
    if (input.templateId) {
      const [template] = await db.select().from(templates).where(eq(templates.id, input.templateId)).limit(1)
      if (!template || template.status !== 'active' || template.conversionStatus !== 'ready') throw new Error('Select an enabled, ready editable template.')
      const allowed = new Set((await db.select({ id: templateSizes.id }).from(templateSizes).where(eq(templateSizes.templateId, input.templateId))).map((size) => size.id))
      if (input.templatePrices.some((price) => !allowed.has(price.templateSizeId))) throw new Error('A selected price does not belong to this template.')
    }
    const result = await db.transaction(async (tx) => {
      const [product] = await tx.insert(products).values({
        sku: input!.sku, name: input!.name, description: input!.description, basePrice: input!.basePrice.toFixed(2),
        categoryId: input!.categoryId, templateId: input!.templateId, featured: input!.featured, active: input!.active,
      }).returning()
      await tx.insert(productImages).values(input!.images.map((image) => ({
        productId: product.id, url: image.key ? getStoredAssetUrl(image.key) : image.url!, storageKey: image.key, assetId: image.assetId, alt: image.alt, isPrimary: image.isPrimary, order: image.order,
      })))
      if (input!.templateId) await tx.insert(productTemplateSizePrices).values(input!.templatePrices.map((price) => ({ productId: product.id, templateSizeId: price.templateSizeId, unitPrice: price.unitPrice.toFixed(2), enabled: price.enabled })))
      else {
        const standalone = input!.sizes.length ? input!.sizes : [{ label: 'Standard', width: null, height: null, unit: 'mm', unitPrice: input!.basePrice, enabled: true, order: 0 }]
        await tx.insert(productSizes).values(standalone.map((size) => ({ productId: product.id, label: size.label, width: size.width?.toString(), height: size.height?.toString(), unit: size.unit, unitPrice: size.unitPrice.toFixed(2), enabled: size.enabled, order: size.order })))
      }
      await tx.insert(adminActivityLogs).values(activityValues(session, {
        actionType: 'product.created', entityType: 'product', entityId: product.id, entityName: product.name,
        description: `Created product ${product.name}.`, metadata: { sku: product.sku, imageCount: input!.images.length, inheritedTemplateSizeCount: input!.templatePrices.length },
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
