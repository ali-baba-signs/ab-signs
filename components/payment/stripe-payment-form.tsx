'use client'

import { useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'

function PaymentForm({ returnUrl }: { returnUrl: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (!stripe || !elements || busy) return
    setBusy(true); setError('')
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: 'if_required' })
    if (result.error) { setError(result.error.message || 'Payment could not be completed.'); setBusy(false); return }
    window.location.assign(returnUrl)
  }
  return <div className="space-y-4"><PaymentElement options={{ layout: 'tabs' }} /><p className="text-xs text-muted-foreground">Card details are securely collected by Stripe.</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<Button type="button" onClick={() => void submit()} className="w-full" disabled={!stripe || busy}>{busy ? 'Confirming secure payment…' : 'Pay securely with Stripe'}</Button></div>
}

export function StripePaymentForm({ clientSecret, orderNumber }: { clientSecret: string; orderNumber: string }) {
  const stripePromise = useMemo(() => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''), [])
  const returnUrl = `${window.location.origin}/order-success?status=processing&order=${encodeURIComponent(orderNumber)}`
  return <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}><PaymentForm returnUrl={returnUrl} /></Elements>
}
