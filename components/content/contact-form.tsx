'use client'

import { useState } from 'react'
import { SUPPORT_CATEGORIES } from '@/lib/support/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArtworkUploadCard, type ArtworkSelection } from '@/components/products/artwork-upload-card'

const emptyForm = { name: '', email: '', phone: '', company: '', orderNumber: '', contactReason: 'General enquiry', subject: '', message: '', website: '', product: '', size: '', quantity: '1', requiredDate: '' }

export function ContactForm() {
  const [form, setForm] = useState(emptyForm)
  const [artwork, setArtwork] = useState<ArtworkSelection | null>(null)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const isCustomQuotation = form.contactReason === 'Custom quote'
  const set = (key: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (sending) return
    setSending(true); setNotice(''); setError('')
    try {
      let response: Response
      if (isCustomQuotation) {
        const request = new FormData()
        request.set('name', form.name); request.set('email', form.email); request.set('phone', form.phone); request.set('company', form.company)
        request.set('orderNumber', form.orderNumber); request.set('enquiryType', form.contactReason); request.set('subject', 'Custom quotation request')
        request.set('message', form.message); request.set('website', form.website)
        for (const key of ['product','size','quantity','requiredDate'] as const) request.set(key, form[key])
        request.set('pageUrl', window.location.origin + window.location.pathname)
        if (artwork?.file) request.set('artwork', artwork.file)
        response = await fetch('/api/contact', { method: 'POST', body: request })
      } else {
        response = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, enquiryType: form.contactReason, pageUrl: window.location.origin + window.location.pathname }) })
      }
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Your enquiry could not be sent.')
      setNotice([payload.data?.message, payload.data?.orderStatus ? payload.data.orderStatus.status + ': ' + payload.data.orderStatus.nextStep : payload.data?.verificationRequired ? 'Sign in with your verified order email to view private order status. Our team can also help verify ownership.' : ''].filter(Boolean).join(' '))
      if (artwork?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(artwork.previewUrl)
      setForm(emptyForm)
      setArtwork(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your enquiry could not be sent.')
    } finally { setSending(false) }
  }

  return <form onSubmit={submit} className="rounded-xl border bg-card p-6" >
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Name<Input required minLength={2} maxLength={255} className="mt-2" autoComplete="name" value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
      <label className="text-sm font-semibold">Email<Input required type="email" maxLength={255} className="mt-2" autoComplete="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></label>
      <label className="text-sm font-semibold">Phone (optional)<Input type="tel" maxLength={30} className="mt-2" autoComplete="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} /></label>
      <label className="text-sm font-semibold">Company (optional)<Input maxLength={255} className="mt-2" autoComplete="organization" value={form.company} onChange={(event) => set('company', event.target.value)} /></label>
      <label className="text-sm font-semibold">{form.contactReason === 'Order status' ? 'Order number (required)' : 'Order number (optional)'}<Input required={form.contactReason === 'Order status'} maxLength={80} className="mt-2" value={form.orderNumber} onChange={(event) => set('orderNumber', event.target.value)} /></label>
      <label className="text-sm font-semibold">Contact reason<select required className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.contactReason} onChange={(event) => set('contactReason', event.target.value)}>{SUPPORT_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
      {isCustomQuotation && <><label className="text-sm font-semibold">Product<Input required maxLength={255} value={form.product} onChange={e=>set('product',e.target.value)}/></label><label className="text-sm font-semibold">Size<Input required maxLength={255} value={form.size} onChange={e=>set('size',e.target.value)}/></label><label className="text-sm font-semibold">Quantity<Input required type="number" min="1" max="1000000" value={form.quantity} onChange={e=>set('quantity',e.target.value)}/></label><label className="text-sm font-semibold">Required date (optional)<Input type="date" value={form.requiredDate} onChange={e=>set('requiredDate',e.target.value)}/></label></>}
      {!isCustomQuotation && <label className="text-sm font-semibold sm:col-span-2">Subject<Input required minLength={3} maxLength={255} className="mt-2" value={form.subject} onChange={(event) => set('subject', event.target.value)} /></label>}
      <label className="text-sm font-semibold sm:col-span-2">Message<textarea required minLength={10} maxLength={5000} className={`mt-2 w-full rounded-md border bg-background p-3 ${isCustomQuotation ? 'min-h-56' : 'min-h-36'}`} placeholder={isCustomQuotation ? 'Please describe your required product, size, quantity, and requirements.' : undefined} value={form.message} onChange={(event) => set('message', event.target.value)} /></label>
      <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">Website<Input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => set('website', event.target.value)} /></label>
    </div>
    {isCustomQuotation && <ArtworkUploadCard mode="temporary_quote" productId="" productName="Custom quotation" sizeId="" sizeLabel="" quantity={1} value={artwork} onChange={setArtwork} />}
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded bg-green-50 p-3 text-green-700">{notice}</p>}
    <Button type="submit" className="mt-5" disabled={sending}>{sending ? 'Sending…' : 'Send enquiry'}</Button>
  </form>
}
