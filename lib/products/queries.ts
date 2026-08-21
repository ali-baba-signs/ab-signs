import 'server-only'

import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { productCategories, productImages, products, productSizes, templateProducts, templates } from '@/lib/db/schema'
import { compatibleSizesForTemplate } from '@/lib/templates/compatibility'

export async function getProductsWithDetails(productId?: string, includeInactive = false) {
  const rows = await db.select().from(products)
    .where(productId ? eq(products.id, productId) : includeInactive ? undefined : eq(products.active, true))
    .orderBy(desc(products.createdAt))
  if (!rows.length) return []
  const ids = rows.map((product) => product.id)
  const [images, sizes, categories, templateRows, templateLinks] = await Promise.all([
    db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.order)),
    db.select().from(productSizes).where(inArray(productSizes.productId, ids)).orderBy(asc(productSizes.order)),
    db.select().from(productCategories),
    db.select({ id: templates.id, productId: templates.productId, name: templates.name, status: templates.status, conversionStatus: templates.conversionStatus, previewImageUrl: templates.previewImageUrl }).from(templates),
    db.select().from(templateProducts).where(inArray(templateProducts.productId, ids)),
  ])
  return rows.map((product) => ({
    ...product,
    images: images.filter((image) => image.productId === product.id),
    sizes: sizes.filter((size) => size.productId === product.id),
    category: categories.find((category) => category.id === product.categoryId) ?? null,
    templates: templateRows
      .filter((template) => templateLinks.some((link) => link.productId === product.id && link.templateId === template.id))
      .map((template) => ({
        ...template,
        compatibleSizeIds: compatibleSizesForTemplate(template.id, sizes.filter((size) => size.productId === product.id)).map((size) => size.id),
      })),
    template: templateRows.find((template) => template.status === 'active' && template.conversionStatus === 'ready' && templateLinks.some((link) => link.productId === product.id && link.templateId === template.id)) ?? templateRows.find((template) => template.id === product.templateId) ?? null,
  }))
}
