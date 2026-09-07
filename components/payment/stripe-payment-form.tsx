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
    try {
      const result = await Promise.race([
        stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: 'if_required' }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Stripe is taking longer than expected. Check your connection and try again; the same order cannot be charged twice.')), 45_000)),
      ])
      if (result.error) throw new Error(result.error.message || 'Payment could not be completed. Check the card details and try again.')
      window.location.assign(returnUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Payment could not be completed. Please try again.')
      setBusy(false)
    }
  }
  return <div className="space-y-4"><PaymentElement options={{ layout: 'tabs', defaultValues: { billingDetails: { name: customer.name, email: customer.email, address: customer.address } } }} /><p className="text-xs text-muted-foreground">Card and billing details are securely collected by Stripe.</p>{error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}<Button type="button" onClick={() => void submit()} className="w-full" disabled={!stripe || busy}>{busy ? 'Processing payment…' : 'Pay securely with Stripe'}</Button>{busy && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-live="assertive"><div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-2xl"><span className="mx-auto block h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-primary"/><h2 className="mt-4 text-xl font-bold text-zinc-950">Processing payment…</h2><p className="mt-2 font-semibold text-zinc-700">Please do not refresh or close this page.</p><p className="mt-2 text-sm text-zinc-500">Stripe is securely confirming your card. Duplicate clicks are disabled.</p></div></div>}</div>
}

export function StripePaymentForm({ clientSecret, orderNumber, customer }: { clientSecret: string; orderNumber: string; customer: { email: string; name: string; address: Record<string, string> } }) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  const stripePromise = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey])
  const returnUrl = `${window.location.origin}/order-success?status=processing&order=${encodeURIComponent(orderNumber)}`
  if (!stripePromise) return <p role="alert" className="text-sm text-red-700">Stripe payments are not configured. Please contact support.</p>
  return <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}><PaymentForm returnUrl={returnUrl} customer={customer} /></Elements>
}
