'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { useAdminSession } from '@/lib/admin-auth-client'
import { adminPath } from '@/lib/auth/admin-path'
import { getUserRole } from '@/lib/auth/roles'
import { Input } from '@/components/ui/input'
import { ORDER_STATUS_LABELS, type OrderWorkflowStatus } from '@/lib/orders/workflow'

interface OrderItem { id: string; product?: { id: string; name: string; categoryId: string; categoryName: string } | null }
interface Order { id: string; orderNumber: string; customerEmail: string; status: string; paymentStatus: string; currency: string; totalAmount: string; createdAt: string; items: OrderItem[] }

export default function OrdersManagementPage() {
  const { data: session, isPending } = useAdminSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '', payment: '', product: '', category: '', from: '', to: '' })
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      if (getUserRole(session?.user) !== 'admin') return
      void fetch('/api/orders', { cache: 'no-store', signal: controller.signal }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'Orders could not be loaded.'); setOrders(payload.data.orders) }).catch((caught) => { if (caught.name !== 'AbortError') setError(caught.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [session?.user])
  const products = useMemo(() => Array.from(new Map(orders.flatMap((order) => order.items.flatMap((item) => item.product ? [[item.product.id, item.product.name] as const] : []) )).entries()), [orders])
  const categories = useMemo(() => Array.from(new Map(orders.flatMap((order) => order.items.flatMap((item) => item.product ? [[item.product.categoryId, item.product.categoryName] as const] : []) )).entries()), [orders])
  const visible = useMemo(() => orders.filter((order) => {
    const date = new Date(order.createdAt)
    const text = `${order.orderNumber} ${order.customerEmail} ${order.items.map((item) => `${item.product?.name || ''} ${item.product?.categoryName || ''}`).join(' ')}`.toLowerCase()
    return (!filters.search || text.includes(filters.search.toLowerCase())) && (!filters.status || order.status === filters.status) && (!filters.payment || order.paymentStatus === filters.payment) && (!filters.product || order.items.some((item) => item.product?.id === filters.product)) && (!filters.category || order.items.some((item) => item.product?.categoryId === filters.category)) && (!filters.from || date >= new Date(`${filters.from}T00:00:00`)) && (!filters.to || date <= new Date(`${filters.to}T23:59:59`))
  }), [filters, orders])
  if (isPending) return <div className="grid min-h-screen place-items-center">Loading...</div>
  if (!session?.user || getUserRole(session.user) !== 'admin') return <div className="grid min-h-screen place-items-center"><Link href={adminPath('/login')}>Admin sign in required</Link></div>
  const label = (status: string) => ORDER_STATUS_LABELS[status as OrderWorkflowStatus] || status.replaceAll('_', ' ')
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-7xl">
    <Link href={adminPath()} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Dashboard</Link><h1 className="mt-2 text-3xl font-black">Orders</h1>
    <div className="mt-5 grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-4 xl:grid-cols-7"><label className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4" /><Input className="pl-9" placeholder="Order, customer, product" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label><select className="rounded border px-2" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{Object.entries(ORDER_STATUS_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><select className="rounded border px-2" value={filters.payment} onChange={(event) => setFilters({ ...filters, payment: event.target.value })}><option value="">All payments</option>{['awaiting_payment', 'paid', 'payment_failed', 'cancelled', 'refunded'].map((value) => <option key={value}>{value.replaceAll('_', ' ')}</option>)}</select><select className="rounded border px-2" value={filters.product} onChange={(event) => setFilters({ ...filters, product: event.target.value })}><option value="">All products</option>{products.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select className="rounded border px-2" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><div className="flex gap-1"><Input type="date" aria-label="From date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /><Input type="date" aria-label="To date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></div></div>
    {error && <p className="mt-4 text-red-700">{error}</p>}
    <section className="mt-5 overflow-x-auto rounded-xl border bg-card">{loading ? <p className="p-10 text-center">Loading orders...</p> : !visible.length ? <p className="p-10 text-center text-muted-foreground">No orders match these filters.</p> : <table className="w-full text-sm"><thead className="bg-secondary"><tr>{['Order', 'Customer', 'Items', 'Total', 'Status', 'Payment', 'Date'].map((heading) => <th key={heading} className="px-4 py-3 text-left">{heading}</th>)}</tr></thead><tbody className="divide-y">{visible.map((order) => <tr key={order.id}><td className="px-4 py-3 font-semibold"><Link className="text-primary hover:underline" href={adminPath(`/orders/${order.id}`)}>{order.orderNumber}</Link></td><td className="px-4 py-3">{order.customerEmail}</td><td className="px-4 py-3">{order.items.length}</td><td className="px-4 py-3">{order.currency} ${Number(order.totalAmount).toFixed(2)}</td><td className="px-4 py-3">{label(order.status)}</td><td className="px-4 py-3">{order.paymentStatus.replaceAll('_', ' ')}</td><td className="px-4 py-3">{new Date(order.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>}</section>
  </div></main>
}
