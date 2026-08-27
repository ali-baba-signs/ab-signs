'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { StripePaymentForm } from '@/components/payment/stripe-payment-form'
import { Button } from '@/components/ui/button'

type PaymentState = { orderId: string; orderNumber: string; checkoutToken: string; expiresAt?: string | null }
type Summary = {
  orderId: string
  orderNumber: string
  customer: { email: string; name: string; address: Record<string, string> }
  items: Array<{ id: string; productName: string; size: string; quantity: number; unitPrice: string; totalPrice: string; designId: string | null; templateId: string | null; productImageUrl: string | null; designPreviewUrl: string | null; previewUrl: string | null }>
  totals: { subtotal: string; discount: string; couponCode: string | null; tax: string; shipping: string; total: string; currency: string }
}

export default function PaymentPage() {
  const [payment, setPayment] = useState<{ clientSecret: string; orderNumber: string; customer: Summary['customer'] } | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)

  const prepare = useCallback(async (cancelled: () => boolean) => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    try {
      const stored = sessionStorage.getItem('abs-payment')
      if (!stored) throw new Error('Your checkout session has expired. Please return to checkout.')
      const state = JSON.parse(stored) as PaymentState
      if (state.expiresAt && new Date(state.expiresAt) <= new Date()) throw new Error('Your coupon reservation has expired. Please return to checkout and apply it again.')
      const response = await fetch('/api/payments/intent', { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: state.orderId, checkoutToken: state.checkoutToken }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.data?.summary) throw new Error(payload?.error?.message || 'Unable to prepare secure payment.')
      if (cancelled()) return
      setSummary(payload.data.summary)
      if (payload.data.alreadySucceeded) { window.location.assign(`/order-success?order=${encodeURIComponent(state.orderNumber)}`); return }
      if (!payload.data.clientSecret) throw new Error('Stripe did not provide a secure payment session. Please retry.')
      setPayment({ clientSecret: payload.data.clientSecret, orderNumber: state.orderNumber, customer: payload.data.summary.customer })
    } catch (reason) {
      if (!cancelled()) setError(reason instanceof DOMException && reason.name === 'AbortError' ? 'Stripe took too long to respond. Please retry—your order and payment will not be duplicated.' : reason instanceof Error ? reason.message : 'Unable to prepare secure payment.')
    } finally { window.clearTimeout(timeout); if (!cancelled()) setLoading(false) }
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => { void prepare(() => cancelled) }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [prepare, retry])

  if (error) return <main className="grid min-h-[60vh] place-items-center p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-bold">Payment unavailable</h1><p className="mt-3 text-muted-foreground">{error}</p><div className="mt-6 flex justify-center gap-3"><Button variant="outline" onClick={() => { setLoading(true); setError(''); setRetry((value) => value + 1) }}>Retry</Button><Link href="/checkout"><Button>Return to checkout</Button></Link></div></div></main>
  return <main className="min-h-screen bg-background px-4 py-10"><div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_440px]"><section className="rounded-xl border bg-card p-6"><h1 className="text-3xl font-black">Review your order</h1><p className="mt-2 text-muted-foreground">These item details and totals come from the order validated by the server.</p><div className="mt-6 space-y-4">{summary?.items.map((item) => 
  <div key={item.id} className="flex gap-4 border-b pb-4"><div className="flex shrink-0 gap-2">{item.designPreviewUrl && <figure><img src={item.designPreviewUrl} alt={`${item.productName} custom design preview`} className="h-24 w-24 rounded border bg-white object-contain" /><figcaption className="mt-1 text-center text-[10px] text-muted-foreground">Your design</figcaption></figure>}</div><div className="min-w-0 flex-1"><p className="font-semibold">{item.productName}</p><p className="text-sm text-muted-foreground">{item.size} · Quantity {item.quantity}</p><p className="text-xs text-muted-foreground">{summary.totals.currency} ${Number(item.unitPrice).toFixed(2)} each</p>{item.designId && <p className="mt-1 break-all text-xs text-muted-foreground">Design: {item.designId}</p>}{item.templateId && <p className="break-all text-xs text-muted-foreground">Template: {item.templateId}</p>}</div><p className="font-semibold">${Number(item.totalPrice).toFixed(2)}</p></div>)}</div>{summary && <div className="mt-5 space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>${Number(summary.totals.subtotal).toFixed(2)}</span></div>{Number(summary.totals.discount) > 0 && <div className="flex justify-between text-green-700"><span>Discount{summary.totals.couponCode ? ` · ${summary.totals.couponCode}` : ''}</span><span>−${Number(summary.totals.discount).toFixed(2)}</span></div>}<div className="flex justify-between"><span>Shipping</span><span>${Number(summary.totals.shipping).toFixed(2)}</span></div><div className="flex justify-between"><span>GST / tax</span><span>${Number(summary.totals.tax).toFixed(2)}</span></div><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{summary.totals.currency} ${Number(summary.totals.total).toFixed(2)}</span></div></div>}</section><section className="h-fit rounded-xl border bg-card p-6"><div className="flex gap-2"><ShieldCheck className="text-primary"/><div><h2 className="text-xl font-bold">Secure payment</h2><p className="text-sm text-muted-foreground">Powered by Stripe</p></div></div>{payment ? <div className="mt-6"><StripePaymentForm {...payment}/></div> : <div className="mt-8 space-y-3"><div className="h-10 animate-pulse rounded bg-secondary"/><div className="h-10 animate-pulse rounded bg-secondary"/><p className="text-sm text-muted-foreground">{loading ? 'Preparing Stripe Payment Element…' : 'Payment details are unavailable.'}</p></div>}</section></div></main>
}
