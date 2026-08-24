'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { orderMilestoneLabel } from '@/lib/orders/workflow'

interface Order {
  id: string; orderNumber: string; status: string; paymentStatus: string; currency: string; totalAmount: string; createdAt: string
  designConfirmationDeadline: string | null
  items: Array<{ id: string; quantity: number; totalPrice: string; specifications: Record<string, string> | null }>
}
const PAGE_LOAD_TIME = Date.now()

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => void fetch('/api/orders', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Orders could not be loaded.')
      setOrders(payload.data.orders)
    }).catch((caught) => { if (caught.name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'Orders could not be loaded.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) }), 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [])

  const label = orderMilestoneLabel
  return <main className="min-h-screen bg-background"><header className="border-b bg-card"><div className="mx-auto max-w-4xl px-4 py-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" /> Home</Link><h1 className="mt-3 text-3xl font-black">My orders</h1><p className="mt-2 text-muted-foreground">Track design approval, production, delivery, payment, and receipts.</p></div></header><div className="mx-auto max-w-4xl px-4 py-10">
    {loading ? <p className="text-center">Loading orders...</p> : error ? <div className="rounded-xl border bg-card p-10 text-center"><p className="text-red-700">{error}</p><Link href="/sign-in"><Button className="mt-5">Sign in</Button></Link></div> : orders.length === 0 ? <div className="rounded-xl border bg-card p-12 text-center"><Package className="mx-auto h-14 w-14 text-muted-foreground" /><h2 className="mt-4 text-xl font-bold">No orders yet</h2><Link href="/products"><Button className="mt-5">Browse products</Button></Link></div> : <div className="space-y-5">{orders.map((order) => {
      const delayed = order.status === 'pending_design_confirmation' && order.designConfirmationDeadline && new Date(order.designConfirmationDeadline).getTime() < PAGE_LOAD_TIME
      return <article key={order.id} className="overflow-hidden rounded-xl border bg-card"><header className="flex flex-wrap items-center justify-between gap-4 bg-secondary/50 p-5"><div><h2 className="font-bold">Order {order.orderNumber}</h2><p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p></div><div className="flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-semibold"><Clock className="h-4 w-4 text-primary" />{label(order.status)} · {order.paymentStatus.replaceAll('_', ' ')}</div></header><div className="p-5"><ul className="divide-y">{order.items.map((item) => <li key={item.id} className="flex justify-between py-3 text-sm"><span>{item.specifications?.sizeLabel || 'Product'} × {item.quantity}</span><span>{order.currency} ${Number(item.totalPrice).toFixed(2)}</span></li>)}</ul>{delayed && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">The six-hour design confirmation target has passed. Your order remains active.</p>}<div className="mt-4 flex items-end justify-between border-t pt-4"><div><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-black text-primary">{order.currency} ${Number(order.totalAmount).toFixed(2)}</p></div><Link href={`/account/orders/${order.id}`}><Button>View details and timeline</Button></Link></div></div></article>
    })}</div>}
  </div></main>
}
