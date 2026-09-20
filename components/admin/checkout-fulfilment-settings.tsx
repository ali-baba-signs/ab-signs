'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { ShippingBand } from '@/lib/shipping/bands'

export interface FulfilmentSettings {
  taxEnabled: boolean
  taxName: string
  taxRate: number | string
  shippingCost: number | string
  freeShippingThreshold: number | string
  bannerShippingBands: ShippingBand[]
  turnaroundDays: string
  allowGuestCheckout: boolean
}

export function CheckoutFulfilmentSettings({ settings, onChange }: { settings: FulfilmentSettings; onChange: (patch: Partial<FulfilmentSettings>) => void }) {
  const bands = settings.bannerShippingBands
  function updateBand(index: number, patch: Partial<ShippingBand>) {
    onChange({ bannerShippingBands: bands.map((band, row) => row === index ? { ...band, ...patch } : band) })
  }
  return <section id="checkout-fulfilment" className="rounded-xl border bg-card p-4 sm:p-6">
    <h2 className="text-xl font-bold">Checkout &amp; Fulfilment</h2>
    <h3 className="mt-6 font-semibold">Tax settings</h3>
    <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={settings.taxEnabled} onChange={(event) => onChange({ taxEnabled: event.target.checked })} />Enable GST/Tax</label>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Tax name<Input required maxLength={40} className="mt-2" value={settings.taxName} onChange={(event) => onChange({ taxName: event.target.value })} /></label>
      <label className="text-sm font-semibold">Tax rate (%)<Input required type="number" min="0" max="100" step="0.01" className="mt-2" value={settings.taxRate} onChange={(event) => onChange({ taxRate: event.target.value })} /></label>
    </div>
    <p className="mt-3 text-sm text-muted-foreground">Tax applies to discounted product costs plus shipping. Disabling tax makes the tax amount zero. Vouchers apply only to products.</p>
    <h3 className="mt-6 font-semibold">Banner printed-area shipping</h3>
    <p className="mt-2 text-sm text-muted-foreground">Total printed area includes quantity. The first tier starts at 0. Each next tier starts above the previous maximum, with no gaps (for example, over 2 up to 5 m²). Leave the final maximum blank for no upper limit.</p>
    <div className="mt-4 space-y-3">{bands.map((band, index) => <fieldset key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
      <legend className="px-1 text-sm font-semibold">Tier {index + 1}</legend>
      <label className="text-sm">Minimum area (m²)<Input required type="number" min="0" step="0.01" value={band.minAreaM2 ?? (index ? bands[index - 1].maxAreaM2 ?? 0 : 0)} onChange={(event) => updateBand(index, { minAreaM2: Number(event.target.value) })} /></label>
      <label className="text-sm">Maximum area (m²)<Input required={index < bands.length - 1} type="number" min="0.01" step="0.01" placeholder="No maximum" value={band.maxAreaM2 ?? ''} onChange={(event) => updateBand(index, { maxAreaM2: event.target.value === '' ? null : Number(event.target.value) })} /></label>
      <label className="text-sm">Shipping fee ($)<Input required type="number" min="0" step="0.01" value={band.price} onChange={(event) => updateBand(index, { price: Number(event.target.value) })} /></label>
    </fieldset>)}</div>
    <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={bands.length >= 10} onClick={() => { const boundary = (bands.at(-1)?.minAreaM2 ?? bands.at(-2)?.maxAreaM2 ?? 0) + 10; onChange({ bannerShippingBands: [...bands.map((band, index) => index === bands.length - 1 ? { ...band, maxAreaM2: boundary } : band), { minAreaM2: boundary, maxAreaM2: null, price: bands.at(-1)?.price ?? 0 }] }) }}>Add tier</Button><Button type="button" variant="outline" disabled={bands.length <= 1} onClick={() => onChange({ bannerShippingBands: bands.slice(0, -1).map((band, index) => index === bands.length - 2 ? { ...band, maxAreaM2: null } : band) })}>Remove final tier</Button></div>
    <h3 className="mt-6 font-semibold">Global and product shipping</h3>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Standard shipping fee ($)<Input required type="number" min="0" step="0.01" value={settings.shippingCost} onChange={(event) => onChange({ shippingCost: event.target.value })} /></label>
      <label className="text-sm font-semibold">Free standard shipping from ($)<Input required type="number" min="0" step="0.01" value={settings.freeShippingThreshold} onChange={(event) => onChange({ freeShippingThreshold: event.target.value })} /></label>
    </div>
    <p className="mt-3 text-sm text-muted-foreground">The threshold uses the product subtotal after vouchers and applies only to standard shipping. Banner area fees still apply. Mixed global-rule carts pay the higher of the banner fee and standard fee. A threshold of 0 makes standard shipping free.</p>
    <p className="mt-2 text-sm text-muted-foreground">Each product can use global rules, free shipping, or a custom fee. Free products add no shipping or billable banner area. Custom fees are charged once per distinct product per order, added to global shipping, and are not waived by the threshold. Pickup is always free.</p>
    <label className="mt-4 block text-sm font-semibold">Turnaround time<Input required className="mt-2" value={settings.turnaroundDays} onChange={(event) => onChange({ turnaroundDays: event.target.value })} /></label>
    <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={settings.allowGuestCheckout} onChange={(event) => onChange({ allowGuestCheckout: event.target.checked })} />Allow guest checkout</label>
  </section>
}
