import 'server-only'

import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orderItems, orders, productCategories, productImages, productReviews, products, productSizes, templateProducts, templates } from '@/lib/db/schema'
import { compatibleSizesForTemplate } from '@/lib/templates/compatibility'
import { designConfigurationsForSize } from '@/lib/products/design-configurations'

export async function getProductsWithDetails(productId?: string, includeInactive = false) {
  const rows = await db.select().from(products)
    .where(productId ? eq(products.id, productId) : includeInactive ? undefined : eq(products.active, true))
    .orderBy(desc(products.createdAt))
  if (!rows.length) return []
  const ids = rows.map((product) => product.id)
  const [images, sizes, categories, templateRows, templateLinks, reviewSummary, soldSummary] = await Promise.all([
    db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.order)),
    db.select().from(productSizes).where(inArray(productSizes.productId, ids)).orderBy(asc(productSizes.order)),
    db.select().from(productCategories),
    db.select({ id: templates.id, productId: templates.productId, name: templates.name, status: templates.status, conversionStatus: templates.conversionStatus, previewImageUrl: templates.previewImageUrl, templateSide: templates.templateSide }).from(templates),
    db.select().from(templateProducts).where(inArray(templateProducts.productId, ids)),
    db.select({ productId: productReviews.productId, averageRating: sql<number>`coalesce(avg(${productReviews.overall}), 0)`, reviewCount: sql<number>`count(*)::int` }).from(productReviews).where(and(inArray(productReviews.productId, ids), eq(productReviews.moderationStatus, 'published'))).groupBy(productReviews.productId),
    db.select({ productId: orderItems.productId, soldQuantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(inArray(orderItems.productId, ids), eq(orders.paymentStatus, 'paid'), notInArray(orders.status, ['cancelled', 'refunded']))).groupBy(orderItems.productId),
  ])
  return rows.map((product) => {
    const productSizeRows = sizes.filter((size) => size.productId === product.id)
    const configuredTemplateIds = new Set(productSizeRows.flatMap((size) => designConfigurationsForSize(size).flatMap((configuration) => [configuration.singleTemplateId, configuration.frontTemplateId, configuration.backTemplateId].filter((id): id is string => Boolean(id)))))
    const linkedTemplateIds = new Set(templateLinks.filter((link) => link.productId === product.id).map((link) => link.templateId))
    const availableTemplateIds = new Set([...configuredTemplateIds, ...linkedTemplateIds, ...(product.templateId ? [product.templateId] : [])])
    return ({
    ...product,
    images: images.filter((image) => image.productId === product.id),
    sizes: productSizeRows,
    category: categories.find((category) => category.id === product.categoryId) ?? null,
    socialProof: {
      averageRating: Number(reviewSummary.find((row) => row.productId === product.id)?.averageRating || 0),
      reviewCount: Number(reviewSummary.find((row) => row.productId === product.id)?.reviewCount || 0),
      soldQuantity: Number(soldSummary.find((row) => row.productId === product.id)?.soldQuantity || 0),
    },
    templates: templateRows
      .filter((template) => template.templateSide !== 'back' && availableTemplateIds.has(template.id))
      .map((template) => ({
        ...template,
        compatibleSizeIds: compatibleSizesForTemplate(template.id, productSizeRows).map((size) => size.id),
      })),
    template: templateRows.find((template) => template.templateSide !== 'back' && template.status === 'active' && template.conversionStatus === 'ready' && availableTemplateIds.has(template.id)) ?? null,
  })})
}

export async function getPopularProducts(limit = 3) {
  const rows = await getProductsWithDetails()
  return [...rows]
    .filter((product) => product.images.length > 0)
    .sort((left, right) => right.socialProof.soldQuantity - left.socialProof.soldQuantity || Number(Boolean(right.featured)) - Number(Boolean(left.featured)) || left.name.localeCompare(right.name))
    .slice(0, Math.max(0, limit))
}
