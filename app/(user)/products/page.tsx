import { getProductsWithDetails } from '@/lib/products/queries'
import { ProductsClient } from './products-client'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const products = (await getProductsWithDetails()).filter((product) =>
    !product.sku.startsWith('SYSTEM_') && product.sku !== 'CUSTOM-ARTWORK-ITEM' && product.name !== 'Custom Product'
  ).slice(0, 100)
  return <ProductsClient initialProducts={products} />
}
