'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2, Package, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/lib/cart-context'

type StoredPayment = { orderId: string; orderNumber: string; checkoutToken: string }

export function OrderSuccessContent({ orderNumber }: { orderNumber?: string }) {
  const { clearCart } = useCart()
  const [status, setStatus] = useState<'checking' | 'paid' | 'failed' | 'pending'>('checking')
  const [message, setMessage] = useState('Stripe is confirming your payment securely.')
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const check = async () => {
      try {
        const raw = sessionStorage.getItem('abs-payment')
        if (!raw) { setStatus('pending'); setMessage('Open your account orders to check the latest verified payment status.'); return }
        const payment = JSON.parse(raw) as StoredPayment
        const response = await fetch('/api/payments/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: payment.orderId, checkoutToken: payment.checkoutToken }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message || 'Payment status could not be checked.')
        if (payload.data.paymentStatus === 'paid') { clearCart(); sessionStorage.removeItem('abs-payment'); setStatus('paid'); setMessage('Your payment is verified and your order is confirmed.'); return }
        if (['payment_failed', 'cancelled'].includes(payload.data.paymentStatus)) { setStatus('failed'); setMessage(payload.data.paymentStatus === 'cancelled' ? 'This payment was cancelled.' : 'Stripe could not complete this payment. You can retry safely.'); return }
        attempts += 1
        if (attempts >= 15) { setStatus('pending'); setMessage('Payment is still processing. You can safely leave this page and check your order shortly.'); return }
        if (!stopped) timer = setTimeout(check, 2000)
      } catch (error) { setStatus('pending'); setMessage(error instanceof Error ? error.message : 'Payment status is temporarily unavailable.') }
    }
    void check()
    return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [clearCart])
  const paid = status === 'paid'
  return <main className="grid min-h-[75vh] place-items-center bg-background px-4 py-12"><div className="max-w-lg text-center">{paid ? <CheckCircle2 className="mx-auto h-16 w-16 text-green-600"/> : status === 'failed' ? <AlertCircle className="mx-auto h-16 w-16 text-red-600"/> : <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary"/>}<h1 className="mt-6 text-3xl font-black">{paid ? 'Payment confirmed' : status === 'failed' ? 'Payment not completed' : 'Payment submitted'}</h1><p className="mt-3 text-muted-foreground">{message}</p>{orderNumber&&<p className="mt-5 rounded-lg bg-secondary p-4 font-mono font-bold">Order {orderNumber}</p>}<div className="mt-7 rounded-xl border bg-card p-6 text-left"><div className="flex gap-3"><Package className="mt-0.5 h-5 w-5 text-primary"/><div><h2 className="font-bold">What happens next</h2><p className="mt-1 text-sm text-muted-foreground">The Stripe webhook is the authoritative payment confirmation. A confirmation email is sent once the verified paid state is recorded.</p></div></div></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{status === 'failed' ? <Link href="/payment"><Button variant="outline" className="w-full">Retry payment</Button></Link> : <Link href="/account/orders"><Button variant="outline" className="w-full">View orders</Button></Link>}<Link href="/products"><Button className="w-full">Continue shopping <ArrowRight/></Button></Link></div></div></main>
}
