/** Tax follows the product-only voucher and shipping calculation. */
export function checkoutTaxCents(discountedProductCents: number, shippingCents: number, enabled: boolean, rate: number) {
  return enabled ? Math.round((Math.max(0, discountedProductCents) + Math.max(0, shippingCents)) * rate / 100) : 0
}
