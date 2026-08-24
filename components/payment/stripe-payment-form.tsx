'use client'

import { useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'

function PaymentForm({ returnUrl, customer }: { returnUrl: string; customer: { email: string; name: string; address: Record<string, string> } }) {
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
  return <div className="space-y-4"><PaymentElement options={{ layout: 'tabs', defaultValues: { billingDetails: { name: customer.name, email: customer.email, address: customer.address } } }} /><p className="text-xs text-muted-foreground">Card and billing details are securely collected by Stripe.</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<Button type="button" onClick={() => void submit()} className="w-full" disabled={!stripe || busy}>{busy ? 'Confirming secure payment…' : 'Pay securely with Stripe'}</Button></div>
}

export function StripePaymentForm({ clientSecret, orderNumber, customer }: { clientSecret: string; orderNumber: string; customer: { email: string; name: string; address: Record<string, string> } }) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  const stripePromise = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey])
  const returnUrl = `${window.location.origin}/order-success?status=processing&order=${encodeURIComponent(orderNumber)}`
  if (!stripePromise) return <p role="alert" className="text-sm text-red-700">Stripe payments are not configured. Please contact support.</p>
  return <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}><PaymentForm returnUrl={returnUrl} customer={customer} /></Elements>
}
