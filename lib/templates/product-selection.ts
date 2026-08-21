import 'server-only'

import { asc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { products, productSizes } from '@/lib/db/schema'
import type { TemplateInput } from './validation'

export async function resolveTemplateProducts(input: TemplateInput) {
  const selected = await db.select().from(products).where(inArray(products.id, input.productIds))
  if (selected.length !== input.productIds.length || selected.some((product) => !product.active)) throw new Error('Select active products for this template.')
  const allSizes = await db.select().from(productSizes).where(inArray(productSizes.productId, input.productIds)).orderBy(asc(productSizes.order))
  for (const product of selected) if (!allSizes.some((size) => size.productId === product.id && size.enabled && Number(size.width) > 0 && Number(size.height) > 0)) throw new Error(`${product.name} needs at least one enabled production size.`)
  const primaryProduct = selected.find((product) => product.id === input.productIds[0])!
  const primarySizes = allSizes.filter((size) => size.productId === primaryProduct.id && size.enabled && Number(size.width) > 0 && Number(size.height) > 0)
  const baseSize = primarySizes.find((size) => size.isDefault) || primarySizes[0]
  return { products: selected, primaryProduct, allSizes, baseSize }
}
