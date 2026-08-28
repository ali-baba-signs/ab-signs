'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CreditCard, Save, ShieldCheck } from 'lucide-react'
import { useCart } from '@/lib/cart-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AUSTRALIAN_STATES } from '@/lib/address/australia'
import { calculateShipping, DEFAULT_BANNER_SHIPPING_BANDS } from '@/lib/shipping/calculator'

const emptyAddress = { firstName: '', lastName: '', address: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'Australia', phone: '' }
type Address = typeof emptyAddress
type SavedAddress = { id: string; label: string; fullName: string; phone: string | null; addressLine1: string; addressLine2: string | null; city: string; region: string | null; postalCode: string; country: string; defaultShipping: boolean; defaultBilling: boolean }
type AppliedCoupon = { code: string; discountCents: number; description: string | null }

function checkoutAddress(saved: SavedAddress): Address {
  const parts = saved.fullName.trim().split(/\s+/)
  return { firstName: parts.shift() || '', lastName: parts.join(' '), address: saved.addressLine1, addressLine2: saved.addressLine2 || '', city: saved.city, state: saved.region || '', postalCode: saved.postalCode, country: saved.country, phone: saved.phone || '' }
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, total, ready } = useCart()
  const [email, setEmail] = useState('')
  const [shipping, setShipping] = useState<Address>(emptyAddress)
  const [billing, setBilling] = useState<Address>(emptyAddress)
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [shippingAddressId, setShippingAddressId] = useState('')
  const [billingAddressId, setBillingAddressId] = useState('')
  const [sameBilling, setSameBilling] = useState(true)
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery')
  const [policiesAccepted, setPoliciesAccepted] = useState(false)
  const [policyWarning, setPolicyWarning] = useState(false)
  const [idempotencyKey] = useState(() => `checkout_${crypto.randomUUID()}`)
  const [settings, setSettings] = useState({ currency: 'AUD', taxRate: 10, shippingCost: 0, freeShippingThreshold: 50, bannerShippingBands: DEFAULT_BANNER_SHIPPING_BANDS })
  const [submitting, setSubmitting] = useState(false)
  const [addressBusy, setAddressBusy] = useState(false)
  const [error, setError] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)
  const [couponError, setCouponError] = useState('')
  const [eligibleCoupons, setEligibleCoupons] = useState<AppliedCoupon[]>([])

  useEffect(() => {
    router.prefetch('/payment')
    const loadSettings = async () => { const response = await fetch('/api/store/settings'); if (response.ok) setSettings((await response.json()).data) }
    const loadProfile = async () => { const response = await fetch('/api/account/profile'); if (response.ok) { const profile = (await response.json()).data.profile; setEmail(profile.email || ''); setShipping((current) => ({ ...current, phone: profile.phone || current.phone })) } }
    const loadAddresses = async () => { const response = await fetch('/api/account/addresses', { cache: 'no-store' }); if (response.ok) {
        const saved = ((await response.json()).data.addresses || []) as SavedAddress[]
        setAddresses(saved)
        const defaultShipping = saved.find((item) => item.defaultShipping) || saved[0]
        const defaultBilling = saved.find((item) => item.defaultBilling) || defaultShipping
        if (defaultShipping) { setShippingAddressId(defaultShipping.id); setShipping(checkoutAddress(defaultShipping)) }
        if (defaultBilling) { setBillingAddressId(defaultBilling.id); setBilling(checkoutAddress(defaultBilling)) }
      } }
    void Promise.allSettled([loadSettings(), loadProfile(), loadAddresses()])
  }, [router])

  useEffect(() => {
    if (!ready || !items.length) return
    void fetch('/api/coupons/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: items.map((item) => ({ productId: item.productId, sizeId: item.sizeId, quantity: item.quantity })) }) })
      .then(async (response) => response.ok ? (await response.json()).data?.coupons || [] : [])
      .then((rows) => setEligibleCoupons(rows.map((row: { code: string; discountCents: number; description: string | null }) => ({ code: row.code, discountCents: Number(row.discountCents), description: row.description || null }))))
      .catch(() => setEligibleCoupons([]))
  }, [items, ready])

  const estimate = useMemo(() => { const discount = coupon ? coupon.discountCents / 100 : 0; const discountedSubtotal = Math.max(0, total - discount); const calculated = calculateShipping({ deliveryType, productSubtotal: total, standardShippingCost: settings.shippingCost, freeShippingThreshold: settings.freeShippingThreshold, bannerBands: settings.bannerShippingBands, lines: items.map((item) => ({ quantity: item.quantity, width: Number(item.specifications?.width || 0), height: Number(item.specifications?.height || 0), unit: item.specifications?.unit || 'mm', freeShipping: item.specifications?.freeShipping === 'true', isBanner: ['custom_banners','mesh_banners','vinyl_banners'].includes(item.specifications?.shippingCategory || '') })) }); const tax = total * settings.taxRate / 100; return { discount, shipping: calculated.amount, tax, bannerAreaM2: calculated.bannerAreaM2, total: discountedSubtotal + calculated.amount + tax } }, [coupon, deliveryType, items, settings, total])
  function update(which: 'shipping' | 'billing', key: keyof Address, value: string) { (which === 'shipping' ? setShipping : setBilling)((current) => ({ ...current, [key]: value })) }
  function selectSaved(which: 'shipping' | 'billing', id: string) { const saved = addresses.find((item) => item.id === id); if (!saved) return; if (which === 'shipping') { setShippingAddressId(id); setShipping(checkoutAddress(saved)) } else { setBillingAddressId(id); setBilling(checkoutAddress(saved)) } }

  async function saveAddress(which: 'shipping' | 'billing') {
    const value = which === 'shipping' ? shipping : billing
    const selectedId = which === 'shipping' ? shippingAddressId : billingAddressId
    setAddressBusy(true); setError('')
    try {
      const body = { label: selectedId ? addresses.find((item) => item.id === selectedId)?.label || 'Checkout' : 'Checkout', fullName: `${value.firstName} ${value.lastName}`.trim(), phone: value.phone, alternatePhone: '', addressLine1: value.address, addressLine2: value.addressLine2, city: value.city, region: value.state, postalCode: value.postalCode, country: value.country, deliveryInstructions: '', defaultShipping: which === 'shipping', defaultBilling: which === 'billing' }
      const response = await fetch(selectedId ? `/api/account/addresses/${selectedId}` : '/api/account/addresses', { method: selectedId ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'Address could not be saved.')
      const refreshed = await fetch('/api/account/addresses').then((result) => result.json()); setAddresses(refreshed.data?.addresses || [])
      if (which === 'shipping') setShippingAddressId(payload.data.address.id); else setBillingAddressId(payload.data.address.id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Address could not be saved.') } finally { setAddressBusy(false) }
  }

  async function applyCoupon() {
    if (!couponInput.trim() || couponBusy) return
    setCouponBusy(true); setCouponError('')
    try { const response = await fetch('/api/coupons/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: couponInput, items: items.map((item) => ({ productId: item.productId, sizeId: item.sizeId, quantity: item.quantity })) }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'Coupon could not be applied.'); const applied = payload.data.coupon; setCoupon({ code: applied.code, discountCents: Number(applied.discountCents), description: applied.description || null }); setCouponInput(applied.code) }
    catch (reason) { setCoupon(null); setCouponError(reason instanceof Error ? reason.message : 'Coupon could not be applied.') } finally { setCouponBusy(false) }
  }

  const fields = (which: 'shipping' | 'billing', value: Address) => <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">First name<Input required className="mt-1" value={value.firstName} onChange={(event) => update(which, 'firstName', event.target.value)} /></label><label className="text-sm font-semibold">Last name<Input required className="mt-1" value={value.lastName} onChange={(event) => update(which, 'lastName', event.target.value)} /></label><label className="text-sm font-semibold sm:col-span-2">Address line 1<Input required className="mt-1" autoComplete="address-line1" value={value.address} onChange={(event) => update(which, 'address', event.target.value)} /></label><label className="text-sm font-semibold sm:col-span-2">Address line 2<Input className="mt-1" autoComplete="address-line2" value={value.addressLine2} onChange={(event) => update(which, 'addressLine2', event.target.value)} /></label><label className="text-sm font-semibold">Suburb<Input required className="mt-1" autoComplete="address-level2" value={value.city} onChange={(event) => update(which, 'city', event.target.value)} /></label><label className="text-sm font-semibold">State / territory<select required className="mt-1 h-10 w-full rounded-lg border bg-background px-3" value={value.state} onChange={(event) => update(which, 'state', event.target.value)}><option value="">Select state</option>{AUSTRALIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label><label className="text-sm font-semibold">Postcode<Input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className="mt-1" autoComplete="postal-code" value={value.postalCode} onChange={(event) => update(which, 'postalCode', event.target.value.replace(/\D/g, '').slice(0, 4))} /></label><label className="text-sm font-semibold">Country<Input readOnly aria-readonly="true" className="mt-1" value="Australia" /></label><label className="text-sm font-semibold sm:col-span-2">Phone<Input required type="tel" className="mt-1" value={value.phone} onChange={(event) => update(which, 'phone', event.target.value)} /></label></div>

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting) return
    if (!policiesAccepted) { setPolicyWarning(true); setError('Please accept the store policies before continuing.'); document.getElementById('policy-acceptance')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    setSubmitting(true); setError('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    try {
      const response = await fetch('/api/orders', { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey, paymentMethod: 'stripe', deliveryType, policiesAccepted, couponCode: coupon?.code, customer: { email, phone: shipping.phone }, shippingAddress: shipping, billingSameAsShipping: sameBilling, billingAddress: billing, items: items.map((item) => ({ productId: item.productId, sizeId: item.sizeId, templateId: item.templateId, designId: item.designId, artworkId: item.artworkId, designSource: item.designSource, quantity: item.quantity, specifications: item.specifications })) }) })
      const payload = await response.json().catch(() => null); if (!response.ok || !payload?.data?.order) throw new Error(payload?.error?.message || 'Checkout is temporarily unavailable. Please try again.')
      sessionStorage.setItem('abs-payment', JSON.stringify({ orderId: payload.data.order.id, orderNumber: payload.data.order.orderNumber, checkoutToken: idempotencyKey, totals: payload.data.totals, expiresAt: payload.data.paymentExpiresAt, cartLines: items.map((item) => ({ lineId: item.lineId, quantity: item.quantity })) }))
      router.push('/payment')
    } catch (reason) {
      const message = reason instanceof DOMException && reason.name === 'AbortError' ? 'Checkout took too long to respond. Please retry—your order will not be duplicated.' : reason instanceof Error ? reason.message : 'Checkout could not continue.'
      setError(message)
      window.requestAnimationFrame(() => document.getElementById('checkout-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    } finally { window.clearTimeout(timeout); setSubmitting(false) }
  }

  if (!ready) return <div className="grid min-h-[60vh] place-items-center">Loading checkout…</div>
  if (!items.length) return <main className="grid min-h-[60vh] place-items-center"><div className="text-center"><h1 className="text-2xl font-bold">No items to check out</h1><Link href="/cart"><Button className="mt-4">Back to cart</Button></Link></div></main>
  const addressSection = (which: 'shipping' | 'billing', title: string, value: Address, selectedId: string) => <section className="rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">{title}</h2>{addresses.length > 0 && <label className="mt-4 block text-sm font-semibold">Saved address<select className="mt-1 h-11 w-full rounded border bg-background px-3" value={selectedId} onChange={(event) => selectSaved(which, event.target.value)}><option value="">Enter a new address</option>{addresses.map((item) => <option key={item.id} value={item.id}>{item.label} — {item.fullName}, {item.city}</option>)}</select></label>}<div className="mt-4">{fields(which, value)}</div><Button type="button" size="sm" variant="outline" className="mt-4" disabled={addressBusy} onClick={() => void saveAddress(which)}><Save /> {selectedId ? 'Update saved address' : 'Save this address'}</Button></section>

  return <main className="min-h-screen bg-background px-4 py-10"><form onSubmit={submit} className="mx-auto max-w-6xl"><Link href="/cart" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Back to cart</Link><h1 className="mt-3 text-3xl font-black">Checkout</h1>{error && <p id="checkout-error" role="alert" className="mt-5 rounded bg-red-50 p-3 text-red-700">{error}</p>}<div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]"><div className="space-y-6"><section className="rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">Customer information</h2><label className="mt-4 block text-sm font-semibold">Email address<Input required type="email" autoComplete="email" className="mt-1" value={email} onChange={(event) => setEmail(event.target.value)} /></label></section><section className="rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">Fulfilment</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{(['delivery', 'pickup'] as const).map((type) => <label key={type} className="rounded border p-3 font-semibold capitalize"><input type="radio" checked={deliveryType === type} onChange={() => setDeliveryType(type)} /> <span className="ml-2">{type}</span></label>)}</div></section>{addressSection('shipping', deliveryType === 'pickup' ? 'Customer address' : 'Shipping address', shipping, shippingAddressId)}<section className="rounded-xl border bg-card p-6"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={sameBilling} onChange={(event) => setSameBilling(event.target.checked)} />Billing address is the same</label></section>{!sameBilling && addressSection('billing', 'Billing address', billing, billingAddressId)}<section className="rounded-xl border bg-card p-6"><div className="flex gap-2"><ShieldCheck className="text-primary" /><div><h2 className="text-xl font-bold">Secure payment with Stripe</h2><p className="text-sm text-muted-foreground">Your card details are entered on the following secure payment page.</p></div></div></section></div>
    <aside className="h-fit rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">Order summary</h2>{items.map((item) => <div key={item.lineId} className="mt-3 flex gap-3 text-sm">{item.image && <img src={item.image} alt="" className="h-12 w-12 rounded border object-contain"/>}<span className="flex-1">{item.productName} · {item.sizeLabel} × {item.quantity}</span><span>${(item.price * item.quantity).toFixed(2)}</span></div>)}<div className="mt-5 border-t pt-4">{eligibleCoupons.length > 0 && !coupon && <label className="mb-3 block text-sm font-semibold">Eligible vouchers<select className="mt-2 h-10 w-full rounded border bg-background px-2" value="" onChange={(event) => { const selected = eligibleCoupons.find((item) => item.code === event.target.value); if (selected) { setCoupon(selected); setCouponInput(selected.code); setCouponError('') } }}><option value="">Choose a voucher</option>{eligibleCoupons.map((item) => <option key={item.code} value={item.code}>{item.code}{item.description ? ` — ${item.description}` : ''}</option>)}</select></label>}<label className="text-sm font-semibold">Coupon or voucher code<div className="mt-2 flex gap-2"><Input value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} disabled={Boolean(coupon)} />{coupon ? <Button type="button" variant="outline" onClick={() => { setCoupon(null); setCouponInput(''); setCouponError('') }}>Remove</Button> : <Button type="button" variant="outline" disabled={couponBusy} onClick={() => void applyCoupon()}>{couponBusy ? 'Checking…' : 'Apply'}</Button>}</div></label>{couponError && <p role="alert" className="mt-2 text-sm text-red-700">{couponError}</p>}{coupon && <p className="mt-2 text-sm text-green-700">{coupon.code} applied{coupon.description ? ` — ${coupon.description}` : ''}</p>}</div><div className="mt-5 space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><span>Product subtotal</span><span>${total.toFixed(2)}</span></div>{coupon && <div className="flex justify-between text-green-700"><span>Product discount · {coupon.code}</span><span>−${estimate.discount.toFixed(2)}</span></div>}<div className="flex justify-between"><span>Shipping</span><span>${estimate.shipping.toFixed(2)}</span></div>{estimate.bannerAreaM2 > 0 && <p className="text-xs text-muted-foreground">Banner shipping: {estimate.bannerAreaM2.toFixed(2)} m² printed area</p>}<div className="flex justify-between"><span>Tax</span><span>${estimate.tax.toFixed(2)}</span></div><div className="flex justify-between text-lg font-bold"><span>Estimated total</span><span>{settings.currency} ${estimate.total.toFixed(2)}</span></div></div><div id="policy-acceptance" className={`mt-5 rounded-md border p-3 ${policyWarning && !policiesAccepted ? 'border-red-500 bg-red-50' : 'border-transparent'}`}><label className="flex gap-2 text-sm"><input type="checkbox" checked={policiesAccepted} onChange={(event) => { setPoliciesAccepted(event.target.checked); if (event.target.checked) { setPolicyWarning(false); setError('') } }} /><span>I have read and agree with <Link className="underline" href="/policies" target="_blank">all terms and conditions</Link>.</span></label><p className="mt-2 text-xs text-muted-foreground">Accept the policies to unlock the secure payment step.</p>{policyWarning && !policiesAccepted && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">Please accept the store policies before continuing.</p>}</div><div className="relative mt-6"><Button type="submit" className="w-full" size="lg" disabled={submitting || !policiesAccepted}><CreditCard />{submitting ? 'Creating secure checkout…' : 'Continue to payment'}</Button>{!policiesAccepted && !submitting && <button type="button" aria-label="Accept store policies to continue to payment" className="absolute inset-0 cursor-not-allowed rounded-md" onClick={() => { setPolicyWarning(true); setError('Please accept the store policies before continuing.'); document.getElementById('policy-acceptance')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><span className="sr-only">Accept store policies to continue to payment</span></button>}</div><p className="mt-3 text-center text-xs text-muted-foreground">You will review the final server-verified total before entering payment details.</p></aside></div></form></main>
}
