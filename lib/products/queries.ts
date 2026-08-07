import 'server-only'

import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { productCategories, productImages, products, productSizes, productTemplateSizePrices, templates, templateSizes } from '@/lib/db/schema'

export async function getProductsWithDetails(productId?: string, includeInactive = false) {
  const rows = await db.select().from(products)
    .where(productId ? eq(products.id, productId) : includeInactive ? undefined : eq(products.active, true))
    .orderBy(desc(products.createdAt))
  if (!rows.length) return []
  const ids = rows.map((product) => product.id)
  const [images, sizes, categories, templateRows, allTemplateSizes, templatePrices] = await Promise.all([
    db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.order)),
    db.select().from(productSizes).where(inArray(productSizes.productId, ids)).orderBy(asc(productSizes.order)),
    db.select().from(productCategories),
    db.select({ id: templates.id, name: templates.name, status: templates.status }).from(templates),
    db.select().from(templateSizes).orderBy(asc(templateSizes.displayOrder)),
    db.select().from(productTemplateSizePrices).where(inArray(productTemplateSizePrices.productId, ids)),
  ])
  return rows.map((product) => ({
    ...product,
    images: images.filter((image) => image.productId === product.id),
    sizes: product.templateId ? allTemplateSizes.filter((size) => size.templateId === product.templateId).flatMap((size) => {
      const price = templatePrices.find((row) => row.productId === product.id && row.templateSizeId === size.id)
      return price ? [{ ...size, productId: product.id, unitPrice: price.unitPrice, enabled: size.enabled && price.enabled, order: size.displayOrder, templateSizeId: size.id }] : []
    }) : sizes.filter((size) => size.productId === product.id),
    category: categories.find((category) => category.id === product.categoryId) ?? null,
    template: templateRows.find((template) => template.id === product.templateId) ?? null,
  }))
}
