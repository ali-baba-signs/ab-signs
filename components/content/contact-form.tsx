'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const emptyForm = { name: '', email: '', phone: '', company: '', orderNumber: '', enquiryType: '', subject: '', message: '', website: '' }

export function ContactForm() {
  const [form, setForm] = useState(emptyForm)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const set = (key: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (sending) return
    setSending(true); setNotice(''); setError('')
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Your enquiry could not be sent.')
      setNotice(payload.data?.message || 'Thanks — your enquiry has been sent.')
      setForm(emptyForm)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your enquiry could not be sent.')
    } finally { setSending(false) }
  }

  return <form onSubmit={submit} className="rounded-xl border bg-card p-6" noValidate>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Name<Input required minLength={2} maxLength={255} className="mt-2" autoComplete="name" value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
      <label className="text-sm font-semibold">Email<Input required type="email" maxLength={255} className="mt-2" autoComplete="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></label>
      <label className="text-sm font-semibold">Phone (optional)<Input type="tel" maxLength={30} className="mt-2" autoComplete="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} /></label>
      <label className="text-sm font-semibold">Company (optional)<Input maxLength={255} className="mt-2" autoComplete="organization" value={form.company} onChange={(event) => set('company', event.target.value)} /></label>
      <label className="text-sm font-semibold">Order number (optional)<Input maxLength={80} className="mt-2" value={form.orderNumber} onChange={(event) => set('orderNumber', event.target.value)} /></label>
      <label className="text-sm font-semibold">Enquiry type<select required className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.enquiryType} onChange={(event) => set('enquiryType', event.target.value)}><option value="">Select one</option><option>Quote request</option><option>Existing order</option><option>Artwork help</option><option>Product question</option><option>Returns or warranty</option><option>Other</option></select></label>
      <label className="text-sm font-semibold sm:col-span-2">Subject<Input required minLength={3} maxLength={255} className="mt-2" value={form.subject} onChange={(event) => set('subject', event.target.value)} /></label>
      <label className="text-sm font-semibold sm:col-span-2">Message<textarea required minLength={10} maxLength={5000} className="mt-2 min-h-36 w-full rounded-md border bg-background p-3" value={form.message} onChange={(event) => set('message', event.target.value)} /></label>
      <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">Website<Input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => set('website', event.target.value)} /></label>
    </div>
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded bg-green-50 p-3 text-green-700">{notice}</p>}
    <Button type="submit" className="mt-5" disabled={sending}>{sending ? 'Sending…' : 'Send enquiry'}</Button>
  </form>
}
