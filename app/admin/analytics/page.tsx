'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { adminPath } from '@/lib/auth/admin-path'

interface AnalyticsData {
  currency: string
  summary: Record<string, number>
  ordersByStatus: Array<{ status: string; count: number }>
  topProducts: Array<{ id: string; name: string; quantity: number; revenue: string }>
  topCategories: Array<{ id: string; name: string; quantity: number }>
  recentSales: Array<{ order_number: string; total_amount: string; currency: string; status: string; created_at: string }>
  designSources: Array<{ design_source: string; count: number }>
  series: Array<{ period: string; orders: number; revenue: string }>
  productionWorkload: Array<{ status: string; count: number }>
  comparison: { previousPaidRevenue: number; previousOrders: number }
}

const INITIAL_TO = new Date().toISOString().slice(0, 10)
const INITIAL_FROM = new Date(new Date(INITIAL_TO).getTime() - 29 * 86400000).toISOString().slice(0, 10)

export default function AnalyticsPage() {
  const [range, setRange] = useState({ from: INITIAL_FROM, to: INITIAL_TO, group: 'day' })
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      void fetch(`/api/admin/analytics?from=${range.from}&to=${range.to}&group=${range.group}`, { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.error?.message || 'Analytics failed.')
          setData(payload.data)
          setError('')
        })
        .catch((caught) => { if (caught.name !== 'AbortError') setError(caught.message) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [range])

  const money = (value: number) => `${data?.currency || 'AUD'} ${Number(value || 0).toFixed(2)}`
  const revenueMax = Math.max(...(data?.series.map((item) => Number(item.revenue)) || []), 1)

  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-7xl">
    <Link href={adminPath()} className="inline-flex gap-2"><ArrowLeft /> Dashboard</Link>
    <h1 className="mt-2 text-3xl font-black">Analytics</h1>
    <div className="mt-5 flex flex-wrap gap-2"><Input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /><Input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /><select aria-label="Analytics grouping" className="h-10 rounded-md border bg-background px-3" value={range.group} onChange={(event) => setRange({ ...range, group: event.target.value })}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></div>
    {error && <p className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {loading ? <p className="p-12 text-center">Calculating analytics...</p> : !data ? <p className="p-12 text-center">No analytics available.</p> : <>
      <div className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {([['Total revenue', data.summary.total_revenue], ['Paid revenue', data.summary.paid_revenue], ['Pending revenue', data.summary.pending_revenue], ['Average order', data.summary.average_order_value]] as const).map(([label, value]) => <article key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-black">{money(value)}</p></article>)}
        {([['Total orders', data.summary.total_orders], ['Completed', data.summary.completed_orders], ['Cancelled', data.summary.cancelled_orders], ['Products', data.summary.total_products], ['Customers', data.summary.total_customers], ['Awaiting design', data.summary.awaiting_design], ['Design target exceeded', data.summary.delayed_design]] as const).map(([label, value]) => <article key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-black">{Number(value)}</p></article>)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5"><h2 className="font-bold">Revenue by day</h2>{!data.series.length ? <p className="mt-4 text-sm text-muted-foreground">No sales in this period.</p> : <div className="mt-4 flex h-48 items-end gap-1">{data.series.map((row) => <div key={row.period} title={`${row.period}: ${money(Number(row.revenue))}`} className="min-w-2 flex-1 bg-primary" style={{ height: `${Math.max(3, Number(row.revenue) / revenueMax * 100)}%` }} />)}</div>}</section>
        <MetricList title="Orders by status" rows={data.ordersByStatus.map((row) => ({ key: row.status, label: row.status.replaceAll('_', ' '), value: row.count }))} />
        <MetricList title="Top products" rows={data.topProducts.map((row) => ({ key: row.id, label: row.name, value: `${row.quantity} sold` }))} empty="No product sales." />
        <MetricList title="Top categories" rows={data.topCategories.map((row) => ({ key: row.id, label: row.name, value: row.quantity }))} empty="No category sales." />
        <MetricList title="Design source distribution" rows={data.designSources.map((row) => ({ key: row.design_source, label: row.design_source.replaceAll('_', ' '), value: row.count }))} />
        <MetricList title="Production workload" rows={data.productionWorkload.map((row) => ({ key: row.status, label: row.status.replaceAll('_', ' '), value: row.count }))} />
      </div>
    </>}
  </div></main>
}

function MetricList({ title, rows, empty = 'No data in this period.' }: { title: string; rows: Array<{ key: string; label: string; value: string | number }>; empty?: string }) {
  return <section className="rounded-xl border bg-card p-5"><h2 className="font-bold">{title}</h2>{rows.length ? rows.map((row) => <p key={row.key} className="mt-2 flex justify-between"><span className="capitalize">{row.label}</span><b>{row.value}</b></p>) : <p className="mt-3 text-muted-foreground">{empty}</p>}</section>
}
