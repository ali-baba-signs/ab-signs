'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Search, 
  RotateCcw, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  Filter
} from 'lucide-react'
import { useAdminSession } from '@/lib/admin-auth-client'
import { adminPath } from '@/lib/auth/admin-path'
import { getUserRole } from '@/lib/auth/roles'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  ORDER_MILESTONE_LABELS, 
  ORDER_STATUS_LABELS, 
  normalizeOrderStatus, 
  orderMilestone, 
  orderMilestoneLabel 
} from '@/lib/orders/workflow'
import { adminOrderSku } from '@/lib/orders/admin-sku'

interface OrderItem {
  id: string
  specifications?: Record<string, string> | null
  product?: {
    id: string
    name: string
    sku: string
    categoryId: string | null
    categoryName: string
  } | null
}

interface Order {
  id: string
  orderNumber: string
  customerEmail: string
  status: string
  paymentStatus: string
  currency: string
  totalAmount: string
  createdAt: string
  items: OrderItem[]
}

const defaultFilters = {
  search: '',
  status: '',
  payment: '',
  product: '',
  category: '',
  from: '',
  to: '',
}

export default function OrdersManagementPage() {
  const { data: session, isPending } = useAdminSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(defaultFilters)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      if (getUserRole(session?.user) !== 'admin') return
      void fetch('/api/orders', { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.error?.message || 'Orders could not be loaded.')
          setOrders(payload.data?.orders || [])
        })
        .catch((caught) => {
          if (caught.name !== 'AbortError') setError(caught.message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [session?.user])

  const products = useMemo(() => {
    const map = new Map<string, string>()
    for (const order of orders) {
      for (const item of order.items) {
        if (item.product?.id && item.product.name) {
          map.set(item.product.id, item.product.name)
        }
      }
    }
    return Array.from(map.entries())
  }, [orders])

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    for (const order of orders) {
      for (const item of order.items) {
        if (item.product?.categoryId && item.product.categoryName) {
          map.set(item.product.categoryId, item.product.categoryName)
        }
      }
    }
    return Array.from(map.entries())
  }, [orders])

  const visible = useMemo(() => {
    return orders.filter((order) => {
      const date = new Date(order.createdAt)
      const text = `${order.orderNumber} ${order.customerEmail} ${order.items
        .map((item) => `${item.product?.name || ''} ${adminOrderSku(item)}${item.product?.categoryName || ''}`)
        .join(' ')}`.toLowerCase()

      return (
        (!filters.search || text.includes(filters.search.toLowerCase())) &&
        (!filters.status || orderMilestone(order.status) === filters.status) &&
        (!filters.payment || order.paymentStatus === filters.payment) &&
        (!filters.product || order.items.some((item) => item.product?.id === filters.product)) &&
        (!filters.category || order.items.some((item) => item.product?.categoryId === filters.category)) &&
        (!filters.from || date >= new Date(`${filters.from}T00:00:00`)) &&
        (!filters.to || date <= new Date(`${filters.to}T23:59:59`))
      )
    })
  }, [filters, orders])

  const isFiltered = Object.values(filters).some(Boolean)

  const getPaymentBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Paid
          </span>
        )
      case 'awaiting_payment':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4" />
            Awaiting Payment
          </span>
        )
      case 'payment_failed':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-400">
            <AlertCircle className="h-4 w-4" />
            {status.replace('_', ' ')}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground capitalize">
            {status.replace('_', ' ')}
          </span>
        )
    }
  }

const getMilestoneBadge = (status: string) => {
    const milestone = orderMilestone(status)
    const labelText = orderMilestoneLabel(status)
    const specificLabel = ORDER_STATUS_LABELS[normalizeOrderStatus(status)]

    let colorClasses = 'border-slate-300 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'

    // Use the shared milestone grouping for badge colors.
    if (milestone === 'attention' || status.includes('awaiting_design')) {
      colorClasses = 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700'
    } else if (milestone === 'production') {
      colorClasses = 'border-blue-300 bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700'
    } else if (milestone === 'completed' || status.includes('delivered')) {
      colorClasses = 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700'
    } else if (milestone === 'dispatch') {
      colorClasses = 'border-violet-300 bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-700'
    }

    return (
      <div className="flex flex-col gap-1">
        <span className={`inline-flex items-center w-fit rounded-lg border-2 px-3 py-1 text-xs font-extrabold ${colorClasses}`}>
          {labelText}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{specificLabel}</span>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="text-base font-semibold text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    )
  }

  if (!session?.user || getUserRole(session.user) !== 'admin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <AlertCircle className="h-14 w-14 text-destructive" />
        <h2 className="text-2xl font-bold">Admin Privileges Required</h2>
        <Link href={adminPath('/login')}>
          <Button className="h-11 px-6 text-sm font-semibold">Sign in with an Admin Account</Button>
        </Link>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50/70 dark:bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-md px-8 lg:px-12 py-5">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Link
              href={adminPath()}
              className="inline-flex h-11 items-center gap-2.5 rounded-xl border bg-background px-4 text-sm font-bold text-muted-foreground shadow-xs transition hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" /> Dashboard
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
                Orders Management
                <span className="rounded-full bg-primary/10 px-3.5 py-0.5 text-sm font-extrabold text-primary">
                  {orders.length}
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage customer proofs, production floor queues, and dispatch tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
            Showing <strong className="text-base text-foreground font-black">{visible.length}</strong> of {orders.length} orders
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="w-full px-8 lg:px-12 py-8 space-y-8">
        {/* Filters Panel with larger inputs */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-foreground">
              <Filter className="h-5 w-5 text-primary" />
              <span>Search & Filter Orders</span>
            </div>
            {isFiltered && (
              <Button
                variant="ghost"
                size="default"
                onClick={() => setFilters(defaultFilters)}
                className="h-10 gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                Reset all filters
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
            {/* Search Input */}
            <div className="relative xl:col-span-2">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-12 pl-11 text-sm font-medium"
                placeholder="Search order #, customer, product, SKU..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            {/* Milestones Select */}
            <div>
              <select
                className="h-12 w-full rounded-lg border border-input bg-background px-3.5 text-sm font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Milestones</option>
                {Object.entries(ORDER_MILESTONE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Payments Select */}
            <div>
              <select
                className="h-12 w-full rounded-lg border border-input bg-background px-3.5 text-sm font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={filters.payment}
                onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
              >
                <option value="">All Payments</option>
                {['awaiting_payment', 'paid', 'payment_failed', 'cancelled', 'refunded'].map((val) => (
                  <option key={val} value={val}>
                    {val.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Products Select */}
            <div>
              <select
                className="h-12 w-full rounded-lg border border-input bg-background px-3.5 text-sm font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={filters.product}
                onChange={(e) => setFilters({ ...filters, product: e.target.value })}
              >
                <option value="">All Products</option>
                {products.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Categories Select */}
            <div>
              <select
                className="h-12 w-full rounded-lg border border-input bg-background px-3.5 text-sm font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="">All Categories</option>
                {categories.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                title="From Date"
                className="h-12 text-sm px-3"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
              <span className="text-sm font-medium text-muted-foreground">to</span>
              <Input
                type="date"
                title="To Date"
                className="h-12 text-sm px-3"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border-2 border-destructive/20 bg-destructive/10 p-5 text-sm font-bold text-destructive">
            {error}
          </div>
        )}

        {/* Orders Data Table */}
        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex h-72 flex-col items-center justify-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
              <p className="text-base font-semibold text-muted-foreground">Loading orders...</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center p-10 text-center text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
                <ShoppingBag className="h-8 w-8 opacity-60" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No orders found</h3>
              <p className="mt-1 text-sm max-w-md">
                No orders match your active search terms or filters. Try clearing the filter options above.
              </p>
              {isFiltered && (
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setFilters(defaultFilters)}
                  className="mt-5 gap-2 text-sm font-semibold h-11 px-5"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="border-b border-border bg-muted/40 text-xs font-black uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Order #</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Items &amp; SKU</th>
                    <th className="px-6 py-4">Total Amount</th>
                    <th className="px-6 py-4">Workflow Milestone</th>
                    <th className="px-6 py-4">Payment</th>
                    <th className="px-6 py-4">Placed Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((order) => {
                    const skus = [...new Set(order.items.map(adminOrderSku).filter(Boolean))]

                    return (
                      <tr
                        key={order.id}
                        className="transition-colors hover:bg-accent/40 group"
                      >
                        {/* Order Number */}
                        <td className="px-6 py-5">
                          <Link
                            href={adminPath(`/orders/${order.id}`)}
                            className="font-extrabold text-primary group-hover:underline text-base tracking-tight"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>

                        {/* Customer Email */}
                        <td className="px-6 py-5 text-sm font-semibold text-foreground">
                          {order.customerEmail}
                        </td>

                        {/* Items & SKU */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-foreground">
                              {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                            </span>
                            <span className="font-mono text-base text-muted-foreground font-medium truncate max-w-65">
                              {skus.join(', ') || '—'}
                            </span>
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td className="px-6 py-5 font-black text-foreground text-base">
                          {order.currency} ${Number(order.totalAmount).toFixed(2)}
                        </td>

                        {/* Workflow Milestone */}
                        <td className="px-6 py-5">
                          {getMilestoneBadge(order.status)}
                        </td>

                        {/* Payment Status */}
                        <td className="px-6 py-5">
                          {getPaymentBadge(order.paymentStatus)}
                        </td>

                        {/* Placed On */}
                        <td className="px-6 py-5 text-sm font-medium text-muted-foreground whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>

                        {/* Action link */}
                        <td className="px-6 py-5 text-right">
                          <Link
                            href={adminPath(`/orders/${order.id}`)}
                            className="inline-flex items-center gap-1.5 rounded-xl border bg-background px-4 py-2 text-sm font-bold text-foreground shadow-xs hover:bg-primary hover:text-primary-foreground hover:border-primary transition"
                          >
                            <span>Open</span>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
