import fs from 'node:fs'
function edit(path, change) { fs.writeFileSync(path, change(fs.readFileSync(path, 'utf8'))) }
fs.writeFileSync('lib/cart/tax.ts', `/** Tax follows the product-only voucher and shipping calculation. */
export function checkoutTaxCents(discountedProductCents: number, shippingCents: number, enabled: boolean, rate: number) {
  return enabled ? Math.round((Math.max(0, discountedProductCents) + Math.max(0, shippingCents)) * rate / 100) : 0
}
`)
edit('app/api/orders/route.ts', s => "import { checkoutTaxCents } from '@/lib/cart/tax'\n" + s.replace('productSubtotal: subtotalCents / 100,', 'productSubtotal: discountedSubtotalCents / 100,').replace('freeShipping: item.product.freeShipping, isBanner:', 'freeShipping: item.product.freeShipping, productId: item.product.id, customShippingAmount: item.product.customShippingAmount === null ? null : Number(item.product.customShippingAmount), isBanner:').replace(/    \/\/ GST is calculated[^]*?    const taxCents = Math.round\(subtotalCents \* settings.taxRate \/ 100\)/, '    const taxCents = checkoutTaxCents(discountedSubtotalCents, shippingCents, settings.taxEnabled, settings.taxRate)').replace('freeShipping: item.product.freeShipping, shippingCategory:', 'freeShipping: item.product.freeShipping, customShippingAmount: item.product.customShippingAmount, taxName: settings.taxName, taxRate: settings.taxEnabled ? settings.taxRate : 0, shippingCategory:'))
edit('app/(user)/checkout/page.tsx', s => {
  s = s.replace("import { calculateShipping,", "import { checkoutTaxCents } from '@/lib/cart/tax'\nimport { calculateShipping,")
    .replace("currency: 'AUD', taxRate: 10", "currency: 'AUD', taxEnabled: true, taxName: 'GST', taxRate: 10")
    .replace('  const [submitting, setSubmitting]', "  const [shippingProducts, setShippingProducts] = useState<Record<string, { freeShipping: boolean; customShippingAmount: string | null }>>({})\n  const [settingsReady, setSettingsReady] = useState(false)\n  const [submitting, setSubmitting]")
    .replace("    const loadSettings = async () => { const response = await fetch('/api/store/settings'); if (response.ok) setSettings((await response.json()).data) }", "    const loadSettings = async () => { try { const response = await fetch('/api/store/settings', { cache: 'no-store' }); if (!response.ok) throw new Error('Checkout settings are temporarily unavailable. Please reload to try again.'); setSettings((await response.json()).data); setSettingsReady(true) } catch (error) { setSettingsReady(false); setError(error instanceof Error ? error.message : 'Checkout settings could not be loaded.') } }\n    window.addEventListener('focus', loadSettings)")
    .replace('    void Promise.allSettled([loadSettings(), loadProfile(), loadAddresses()])', "    void Promise.allSettled([loadSettings(), loadProfile(), loadAddresses()])\n    return () => window.removeEventListener('focus', loadSettings)")
  const effect = `  const productIds = [...new Set(items.map((item) => item.productId))].sort().join(',')
  useEffect(() => {
    let active = true
    async function refreshProducts() {
      try {
        const entries = await Promise.all(productIds.split(',').filter(Boolean).map(async (id) => {
          const response = await fetch('/api/products/' + encodeURIComponent(id), { cache: 'no-store' })
          const payload = await response.json()
          if (!response.ok) throw new Error('Product shipping details could not be loaded. Please reload to try again.')
          return [id, payload.data.product] as const
        }))
        if (active) setShippingProducts(Object.fromEntries(entries))
      } catch (error) { if (active) setError(error instanceof Error ? error.message : 'Shipping details could not be loaded.') }
    }
    void refreshProducts()
    window.addEventListener('focus', refreshProducts)
    return () => { active = false; window.removeEventListener('focus', refreshProducts) }
  }, [productIds])
  const shippingReady = items.every((item) => shippingProducts[item.productId])

`
  return s.replace('  const estimate = useMemo', effect + '  const estimate = useMemo')
    .replace('productSubtotal: total,', 'productSubtotal: discountedSubtotal,')
    .replace("freeShipping: item.specifications?.freeShipping === 'true',", "productId: item.productId, freeShipping: shippingProducts[item.productId]?.freeShipping ?? item.specifications?.freeShipping === 'true', customShippingAmount: shippingProducts[item.productId]?.customShippingAmount != null ? Number(shippingProducts[item.productId].customShippingAmount) : null,")
    .replace('const tax = total * settings.taxRate / 100;', 'const tax = checkoutTaxCents(Math.round(discountedSubtotal * 100), Math.round(calculated.amount * 100), settings.taxEnabled, settings.taxRate) / 100;')
    .replace('[coupon, deliveryType, items, settings, total]', '[coupon, deliveryType, items, settings, shippingProducts, total]')
    .replace('<span>Tax</span>', "<span>{settings.taxName}{settings.taxEnabled ? ' (' + settings.taxRate + '%)' : ' (disabled)'}</span>")
    .replace('disabled={submitting || !policiesAccepted}', 'disabled={submitting || !policiesAccepted || !settingsReady || !shippingReady}')
})
for (const path of ['app/(user)/products/[id]/page.tsx','app/(user)/design/preview/PreviewContent.tsx']) edit(path, s => s.replace('freeShipping?:boolean;', 'freeShipping?:boolean;customShippingAmount?:string|null;').replace('freeShipping:String(Boolean(product.freeShipping)),', "freeShipping:String(Boolean(product.freeShipping)),customShippingAmount:product.customShippingAmount||'',").replace('freeShipping:String(Boolean(product!.freeShipping)),', "freeShipping:String(Boolean(product!.freeShipping)),customShippingAmount:product!.customShippingAmount||'',"))
