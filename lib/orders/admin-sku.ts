type OrderSkuItem = {
  specifications?: unknown
  product?: { sku?: string | null } | null
}

/** Display only: prefer the immutable order snapshot, never the product's default side. */
export function adminOrderSku(item: OrderSkuItem): string {
  const specs = item.specifications && typeof item.specifications === 'object'
    ? item.specifications as Record<string, unknown>
    : {}
  const sku = typeof specs.sku === 'string' && specs.sku.trim() ? specs.sku : item.product?.sku || ''
  if (!sku) return ''

  const suffixForDesignType = (value: unknown) => value === 'single_side' ? 'SS' : value === 'double_side' ? 'DS' : null
  const suffix = suffixForDesignType(specs.designType)
    ?? suffixForDesignType(specs.designMode)
    // Older orders snapshot the selected production size's side setting here.
    ?? (specs.sideMode === 'single' ? 'SS' : specs.sideMode === 'double' ? 'DS' : null)

  return suffix ? `${sku}-${suffix}` : sku
}
