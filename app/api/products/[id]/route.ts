import { NextRequest, NextResponse } from 'next/server'
import { getProductsWithDetails } from '@/lib/products/queries'
import { sanitizeRichText } from '@/lib/content/sanitize-html'
import { CUSTOM_PRODUCT_ID, CUSTOM_PRODUCT_NAME, CUSTOM_PRODUCT_SKU, customArtworkRate } from '@/lib/products/custom-artwork'
import { loadStoreSettings } from '@/lib/store/load-settings'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // 1. Intercept Custom Product ID so it doesn't execute a failed SQL query
    if (id === CUSTOM_PRODUCT_ID) {
      const settings = await loadStoreSettings()
      return NextResponse.json({
        data: {
          product: {
            id: CUSTOM_PRODUCT_ID,
            name: CUSTOM_PRODUCT_NAME,
            sku: CUSTOM_PRODUCT_SKU,
            description: '',
            active: true,
            sizeMode: 'custom_dimensions',
            allowCustomDimensions: true,
            size_mode: 'custom_dimensions',
            allow_custom_dimensions: true,
            design_mode: 'single_side',
            pricePerSquareMetre: customArtworkRate(settings.customArtworkPricePerM2),
            freeShipping: false,
            customShippingAmount: null,
            images: [],
            isHidden: false,
            sizes: [],
            templates: [],
            template: null,
          },
        },
      })
    }

    // 2. Prevent invalid UUIDs from crashing Postgres
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Product not found.' } },
        { status: 404 }
      )
    }

    // 3. Normal database fetch for real products
    const [product] = await getProductsWithDetails(id)
    if (!product || !product.active) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Product not found.' } },
        { status: 404 }
      )
    }

    const compatibleTemplates = product.templates.filter(
      (template) =>
        template.status === 'active' &&
        template.conversionStatus === 'ready' &&
        template.compatibleSizeIds.length > 0
    )

    return NextResponse.json({
      data: {
        product: {
          ...product,
          description: sanitizeRichText(product.description),
          sizes: product.sizes.filter((size) => size.enabled),
          templates: compatibleTemplates,
          template: compatibleTemplates[0] || null,
        },
      },
    })
  } catch (error) {
    console.error('Product detail load failed', error)
    return NextResponse.json(
      { error: { code: 'PRODUCT_LOAD_FAILED', message: 'The product could not be loaded.' } },
      { status: 500 }
    )
  }
}
