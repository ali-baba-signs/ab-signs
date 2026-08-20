import 'server-only'

import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { productCategories, productImages, products, productSizes, templates } from '@/lib/db/schema'

export async function getProductsWithDetails(productId?: string, includeInactive = false) {
  const rows = await db.select().from(products)
    .where(productId ? eq(products.id, productId) : includeInactive ? undefined : eq(products.active, true))
    .orderBy(desc(products.createdAt))
  if (!rows.length) return []
  const ids = rows.map((product) => product.id)
  const [images, sizes, categories, templateRows] = await Promise.all([
    db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.order)),
    db.select().from(productSizes).where(inArray(productSizes.productId, ids)).orderBy(asc(productSizes.order)),
    db.select().from(productCategories),
    db.select({ id: templates.id, productId: templates.productId, name: templates.name, status: templates.status, conversionStatus: templates.conversionStatus, previewImageUrl: templates.previewImageUrl }).from(templates),
  ])
  return rows.map((product) => ({
    ...product,
    images: images.filter((image) => image.productId === product.id),
    sizes: sizes.filter((size) => size.productId === product.id),
    category: categories.find((category) => category.id === product.categoryId) ?? null,
    templates: templateRows.filter((template) => template.productId === product.id),
    template: templateRows.find((template) => template.productId === product.id && template.status === 'active' && template.conversionStatus === 'ready') ?? templateRows.find((template) => template.id === product.templateId) ?? null,
  }))
}
