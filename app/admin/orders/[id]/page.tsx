'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminPath } from '@/lib/auth/admin-path'
import { allowedTransitions, ORDER_STATUS_LABELS, type OrderWorkflowStatus } from '@/lib/orders/workflow'
import { uploadAdminFile } from '@/lib/storage/upload-client'

interface OrderDetail {
  id: string; orderNumber: string; customerEmail: string; status: string; paymentStatus: string; currency: string; totalAmount: string
  designConfirmationDeadline: string | null; designDelayReason: string | null; deadline: { delayed: boolean; remainingMs: number | null }
  expectedPrintingAt: string | null; expectedDeliveryAt: string | null; courierName: string | null; trackingNumber: string | null
  internalNotes: string | null; customerNotes: string | null
  receiptAssetId: string | null
  items: Array<{ id: string; quantity: number; designSource: string; totalPrice: string; specifications: Record<string, string> | null; product?: { name: string }; artworkUrl?: string; designUrl?: string }>
  history: Array<{ id: string; newStatus: string; customerVisibleNote: string | null; changedAt: string }>
}

const emptyForm = { status: '', paymentStatus: '', expectedPrintingAt: '', expectedDeliveryAt: '', courierName: '', trackingNumber: '', internalNote: '', customerNote: '', delayReason: '', receiptAssetId: '' }

export default function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/orders/${id}`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message || 'Order could not be loaded.')
    const row = payload.data.order as OrderDetail
    setOrder(row)
    setForm({ status: row.status, paymentStatus: row.paymentStatus, expectedPrintingAt: row.expectedPrintingAt?.slice(0, 16) || '', expectedDeliveryAt: row.expectedDeliveryAt?.slice(0, 16) || '', courierName: row.courierName || '', trackingNumber: row.trackingNumber || '', internalNote: row.internalNotes || '', customerNote: row.customerNotes || '', delayReason: row.designDelayReason || '', receiptAssetId: row.receiptAssetId || '' })
  }, [id])

  useEffect(() => { const timer = window.setTimeout(() => void load().catch((caught) => setError(caught.message)), 0); return () => window.clearTimeout(timer) }, [load])

  async function save() {
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/admin/orders/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Update failed.')
      await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Update failed.') } finally { setSaving(false) }
  }
  async function uploadReceipt(file: File) { try { const asset = await uploadAdminFile(file, 'order-document', id); setForm((current) => ({ ...current, receiptAssetId: asset.id })); setError('Receipt uploaded. Save the order to attach it.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Receipt upload failed.') } }

  if (!order) return <div className="grid min-h-screen place-items-center">{error || 'Loading order...'}</div>
  const choices = [order.status, ...allowedTransitions(order.status)]
  const label = (status: string) => ORDER_STATUS_LABELS[status as OrderWorkflowStatus] || status.replaceAll('_', ' ')
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-6xl">
    <Link href={adminPath('/orders')} className="inline-flex items-center gap-2"><ArrowLeft /> Orders</Link>
    <div className="mt-3 flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-black">{order.orderNumber}</h1><p>{order.customerEmail}</p></div><div className={order.deadline.delayed ? 'text-red-700' : 'text-green-700'}>{order.designConfirmationDeadline ? `Design target: ${new Date(order.designConfirmationDeadline).toLocaleString()}${order.deadline.delayed ? ' (delayed)' : ''}` : 'No design deadline'}</div></div>
    {error && <p className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <section className="rounded-xl border bg-card p-5"><h2 className="font-bold">Items and print files</h2>{order.items.map((item) => <div key={item.id} className="mt-3 rounded border p-3"><p className="font-semibold">{item.product?.name || 'Product'} × {item.quantity}</p><p className="text-sm">{item.specifications?.sizeLabel || 'Standard size'} · {item.designSource.replaceAll('_', ' ')}</p><div className="flex flex-wrap gap-4">{item.artworkUrl && <a className="mt-2 inline-flex items-center gap-1 text-primary" href={item.artworkUrl}><Download /> Download authorized artwork</a>}{item.designUrl && <a className="mt-2 inline-flex items-center gap-1 text-primary" href={item.designUrl}><Download /> Download editor design JSON</a>}</div></div>)}</section>
        <section className="rounded-xl border bg-card p-5"><h2 className="font-bold">Milestone history</h2><ol className="mt-4 border-l-2 pl-4">{order.history.map((item) => <li key={item.id} className="mb-4"><p className="font-semibold">{label(item.newStatus)}</p>{item.customerVisibleNote && <p className="text-sm text-muted-foreground">{item.customerVisibleNote}</p>}<time className="text-xs">{new Date(item.changedAt).toLocaleString()}</time></li>)}</ol></section>
      </div>
      <aside className="h-fit space-y-3 rounded-xl border bg-card p-5"><h2 className="font-bold">Update order</h2>
        <label className="block text-sm">Status<select className="mt-1 h-10 w-full rounded border px-2" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{choices.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label className="block text-sm">Payment status<select className="mt-1 h-10 w-full rounded border px-2" value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value })}>{['awaiting_payment', 'paid', 'payment_failed', 'cancelled', 'refunded'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="block text-sm">Expected printing<Input type="datetime-local" value={form.expectedPrintingAt} onChange={(event) => setForm({ ...form, expectedPrintingAt: event.target.value })} /></label>
        <label className="block text-sm">Expected delivery<Input type="datetime-local" value={form.expectedDeliveryAt} onChange={(event) => setForm({ ...form, expectedDeliveryAt: event.target.value })} /></label>
        <label className="block text-sm">Courier<Input value={form.courierName} onChange={(event) => setForm({ ...form, courierName: event.target.value })} /></label>
        <label className="block text-sm">Tracking<Input value={form.trackingNumber} onChange={(event) => setForm({ ...form, trackingNumber: event.target.value })} /></label>
        <label className="block text-sm">Payment receipt / invoice PDF<Input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadReceipt(file) }} />{form.receiptAssetId && <span className="mt-1 block text-xs text-green-700">A receipt PDF is ready to attach.</span>}</label>
        <label className="block text-sm">Customer note<textarea className="mt-1 min-h-20 w-full rounded border p-2" value={form.customerNote} onChange={(event) => setForm({ ...form, customerNote: event.target.value })} /></label>
        <label className="block text-sm">Internal note<textarea className="mt-1 min-h-20 w-full rounded border p-2" value={form.internalNote} onChange={(event) => setForm({ ...form, internalNote: event.target.value })} /></label>
        {order.deadline.delayed && <label className="block text-sm">Delay explanation<textarea className="mt-1 min-h-16 w-full rounded border p-2" value={form.delayReason} onChange={(event) => setForm({ ...form, delayReason: event.target.value })} /></label>}
        <Button className="w-full" onClick={() => void save()} disabled={saving}><Save /> {saving ? 'Saving...' : 'Save milestone'}</Button>
      </aside>
    </div>
  </div></main>
}
