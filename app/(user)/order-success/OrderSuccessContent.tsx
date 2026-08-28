'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/lib/cart-context'
import type { PurchasedCartLine } from '@/lib/cart/checkout-removal'

type StoredPayment = { orderId: string; orderNumber: string; checkoutToken: string; cartLines?: PurchasedCartLine[] }

export function OrderSuccessContent({ orderNumber }: { orderNumber?: string }) {
  const { clearCart, removePurchasedItems } = useCart()
  const [status, setStatus] = useState<'checking' | 'paid' | 'failed' | 'pending'>('checking')
  const [message, setMessage] = useState('Stripe is confirming your payment securely.')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [retry, setRetry] = useState<number>(0)
  const [isSuccess, setIsSuccess] = useState<boolean>(false)

  // Placeholders for summary/payment if fetched elsewhere
  const [summary, setSummary] = useState<any>(null)
  const [payment, setPayment] = useState<any>(null)

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    const check = async () => {
      try {
        const raw = sessionStorage.getItem('abs-payment')
        if (!raw) {
          setStatus('pending')
          setMessage('Open your account orders to check the latest verified payment status.')
          return
        }
        const parsedPayment = JSON.parse(raw) as StoredPayment
        const response = await fetch('/api/payments/status', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            orderId: parsedPayment.orderId,
            checkoutToken: parsedPayment.checkoutToken,
          }),
        })
        const payload = await response.json()
        if (!response.ok)
          throw new Error(payload.error?.message || 'Payment status could not be checked.')

        if (payload.data.paymentStatus === 'paid') {
          if (Array.isArray(parsedPayment.cartLines)) removePurchasedItems(parsedPayment.cartLines)
          else clearCart()
          sessionStorage.removeItem('abs-payment')
          setStatus('paid')
          setMessage('Your payment is verified and your order is confirmed.')
          return
        }
        if (['payment_failed', 'cancelled'].includes(payload.data.paymentStatus)) {
          setStatus('failed')
          setMessage(
            payload.data.paymentStatus === 'cancelled'
              ? 'This payment was cancelled.'
              : 'Stripe could not complete this payment. You can retry safely.'
          )
          return
        }
        attempts += 1
        if (attempts >= 15) {
          setStatus('pending')
          setMessage(
            'Payment is still processing. You can safely leave this page and check your order shortly.'
          )
          return
        }
        if (!stopped) timer = setTimeout(check, 2000)
      } catch (err) {
        setStatus('pending')
        setMessage(
          err instanceof Error ? err.message : 'Payment status is temporarily unavailable.'
        )
      }
    }
    void check()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [clearCart, removePurchasedItems, retry])

  const handleRetry = () => {
    setLoading(true)
    setError('')

    setTimeout(() => {
      setLoading(false)
      setIsSuccess(true)
      setRetry((value) => value + 1)
      setTimeout(() => setIsSuccess(false), 2000) // resets checkmark after 2s
    }, 1000)
  }

  if (error || status === 'failed') {
    return (
      <main className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Payment unavailable</h1>
          <p className="mt-3 text-muted-foreground">{error || message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {isSuccess ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : loading ? (
                <span className="animate-spin text-sm">⏳</span>
              ) : null}
              {isSuccess ? 'Done' : 'Retry'}
            </Button>
            <Link href="/checkout">
              <Button>Return to checkout</Button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_440px]">
        <section className="rounded-xl border bg-card p-6">
          <h1 className="text-3xl font-black">Review your order</h1>
          <p className="mt-2 text-muted-foreground">
            These item details and totals come from the order validated by the server.
          </p>
          <div className="mt-6 space-y-4">
            {summary?.items?.map((item: any) => (
              <div key={item.id} className="flex gap-4 border-b pb-4">
                <div className="flex shrink-0 gap-2">
                  {item.designPreviewUrl && (
                    <figure>
                      <img
                        src={item.designPreviewUrl}
                        alt={`${item.productName} custom design preview`}
                        className="h-24 w-24 rounded border bg-white object-contain"
                      />
                      <figcaption className="mt-1 text-center text-[10px] text-muted-foreground">
                        Your design
                      </figcaption>
                    </figure>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.size} · Quantity {item.quantity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.totals?.currency} ${Number(item.unitPrice || 0).toFixed(2)} each
                  </p>
                  {item.designId && (
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      Design: {item.designId}
                    </p>
                  )}
                  {item.templateId && (
                    <p className="break-all text-xs text-muted-foreground">
                      Template: {item.templateId}
                    </p>
                  )}
                </div>
                <p className="font-semibold">${Number(item.totalPrice || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
          {summary && (
            <div className="mt-5 space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${Number(summary.totals?.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(summary.totals?.discount || 0) > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>
                    Discount
                    {summary.totals?.couponCode ? ` · ${summary.totals.couponCode}` : ''}
                  </span>
                  <span>−${Number(summary.totals.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>${Number(summary.totals?.shipping || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST / tax</span>
                <span>${Number(summary.totals?.tax || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>
                  {summary.totals?.currency} ${Number(summary.totals?.total || 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </section>
        <section className="h-fit rounded-xl border bg-card p-6">
          <div className="flex gap-2">
            <ShieldCheck className="text-primary" />
            <div>
              <h2 className="text-xl font-bold">Secure payment</h2>
              <p className="text-sm text-muted-foreground">Powered by Stripe</p>
            </div>
          </div>
          {payment ? (
            <div className="mt-6">
              {/* Ensure StripePaymentForm is imported if used */}
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              <div className="h-10 animate-pulse rounded bg-secondary" />
              <div className="h-10 animate-pulse rounded bg-secondary" />
              <p className="text-sm text-muted-foreground">
                {loading
                  ? 'Preparing Stripe Payment Element…'
                  : message || 'Payment details are unavailable.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
