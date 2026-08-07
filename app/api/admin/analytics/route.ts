import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { getAdminSession } from '@/lib/auth/require-admin'
import { loadStoreSettings } from '@/lib/store/load-settings'

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  try {
    const toRaw = request.nextUrl.searchParams.get('to')
    const fromRaw = request.nextUrl.searchParams.get('from')
    const to = toRaw && !Number.isNaN(Date.parse(toRaw)) ? new Date(`${toRaw}T23:59:59.999Z`) : new Date()
    const from = fromRaw && !Number.isNaN(Date.parse(fromRaw)) ? new Date(`${fromRaw}T00:00:00.000Z`) : new Date(to.getTime() - 29 * 86400000)
    if (from > to) return NextResponse.json({ error: { message: 'The analytics start date must be before the end date.' } }, { status: 400 })
    const grouping = ['day', 'week', 'month'].includes(request.nextUrl.searchParams.get('group') || '') ? request.nextUrl.searchParams.get('group')! : 'day'
    const groupSql = grouping === 'month' ? sql.raw(`'month'`) : grouping === 'week' ? sql.raw(`'week'`) : sql.raw(`'day'`)
    const periodMs = Math.max(86400000, to.getTime() - from.getTime())
    const previousFrom = new Date(from.getTime() - periodMs)
    const [summary, statuses, topProducts, topCategories, recent, designSources, series, previous, settings] = await Promise.all([
      db.execute(sql`select count(*)::int total_orders,
        coalesce(sum(total_amount) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0) total_revenue,
        coalesce(sum(total_amount) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0) paid_revenue,
        coalesce(sum(total_amount) filter(where payment_status<>'paid' and status not in ('cancelled','refunded')),0) pending_revenue,
        count(*) filter(where status='completed')::int completed_orders,
        count(*) filter(where status='cancelled')::int cancelled_orders,
        coalesce(avg(total_amount) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0) average_order_value,
        count(*) filter(where status='pending_design_confirmation')::int awaiting_design,
        count(*) filter(where status='pending_design_confirmation' and design_confirmation_deadline<now())::int delayed_design,
        (select count(*) from products where active)::int total_products,
        (select count(*) from users where role='customer')::int total_customers
        from orders where created_at between ${from} and ${to}`),
      db.execute(sql`select status,count(*)::int count from orders where created_at between ${from} and ${to} group by status order by count desc`),
      db.execute(sql`select p.id,p.name,sum(oi.quantity)::int quantity,sum(oi.total_price)::numeric revenue from order_items oi join orders o on o.id=oi.order_id join products p on p.id=oi.product_id where o.created_at between ${from} and ${to} and o.payment_status='paid' and o.status not in ('cancelled','refunded') group by p.id,p.name order by quantity desc limit 10`),
      db.execute(sql`select c.id,c.name,sum(oi.quantity)::int quantity,sum(oi.total_price)::numeric revenue from order_items oi join orders o on o.id=oi.order_id join products p on p.id=oi.product_id join product_categories c on c.id=p.category_id where o.created_at between ${from} and ${to} and o.payment_status='paid' and o.status not in ('cancelled','refunded') group by c.id,c.name order by quantity desc limit 10`),
      db.execute(sql`select order_number,total_amount,currency,status,payment_status,created_at from orders where created_at between ${from} and ${to} order by created_at desc limit 10`),
      db.execute(sql`select design_source,count(*)::int count from order_items oi join orders o on o.id=oi.order_id where o.created_at between ${from} and ${to} group by design_source`),
      db.execute(sql`select date_trunc(${groupSql},created_at)::date period,count(*)::int orders,coalesce(sum(total_amount) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0) revenue from orders where created_at between ${from} and ${to} group by period order by period`),
      db.execute(sql`select coalesce(sum(total_amount) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0) paid_revenue,count(*)::int orders from orders where created_at between ${previousFrom} and ${from}`),
      loadStoreSettings(),
    ])
    const row = summary.rows[0] || {}
    return NextResponse.json({ data: {
      range: { from: from.toISOString(), to: to.toISOString(), grouping }, currency: settings.currency,
      summary: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])),
      ordersByStatus: statuses.rows, topProducts: topProducts.rows, topCategories: topCategories.rows, recentSales: recent.rows, designSources: designSources.rows, series: series.rows,
      productionWorkload: statuses.rows.filter((item) => ['order_confirmed', 'in_production', 'quality_check', 'print_ready', 'awaiting_dispatch'].includes(String(item.status))),
      comparison: { previousPaidRevenue: Number(previous.rows[0]?.paid_revenue || 0), previousOrders: Number(previous.rows[0]?.orders || 0) },
    } })
  } catch (error) {
    console.error('Analytics failed', error)
    return NextResponse.json({ error: { message: 'Analytics could not be calculated from current order data.' } }, { status: 500 })
  }
}
