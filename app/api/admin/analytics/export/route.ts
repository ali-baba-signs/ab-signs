import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db/client'
import { getAdminSession } from '@/lib/auth/require-admin'

function rangeOf(request: NextRequest) {
  const fromRaw = request.nextUrl.searchParams.get('from') || ''
  const toRaw = request.nextUrl.searchParams.get('to') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) throw new Error('Choose valid From and To dates before exporting.')
  const from = new Date(`${fromRaw}T00:00:00.000Z`)
  const to = new Date(`${toRaw}T23:59:59.999Z`)
  if (from > to) throw new Error('The analytics start date must not be after the end date.')
  return { from, to, fromRaw, toRaw }
}

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  try {
    const { from, to, fromRaw, toRaw } = rangeOf(request)
    const format = request.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
    const [summary, revenue, orders, statuses, products, categories, customers, sources, production] = await Promise.all([
      db.execute(sql`select count(*)::int as total_orders, coalesce(sum(total_amount),0) as gross_order_value, coalesce(sum(total_amount) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0) as paid_revenue, coalesce(avg(total_amount),0) as average_order_value from orders where created_at between ${from} and ${to}`),
      db.execute(sql`select date_trunc('day',created_at)::date as date,count(*)::int as orders,coalesce(sum(total_amount),0) as gross_order_value,coalesce(sum(total_amount) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0) as paid_revenue from orders where created_at between ${from} and ${to} group by 1 order by 1`),
      db.execute(sql`select o.order_number,o.created_at,o.customer_email,o.status,o.payment_status,o.currency,o.total_amount,o.tax_amount,o.shipping_amount,coalesce(sum(oi.quantity),0)::int as item_quantity from orders o left join order_items oi on oi.order_id=o.id where o.created_at between ${from} and ${to} group by o.id order by o.created_at`),
      db.execute(sql`select status,count(*)::int as orders,coalesce(sum(total_amount),0) as order_value from orders where created_at between ${from} and ${to} group by status order by orders desc`),
      db.execute(sql`select coalesce(oi.specifications->>'productName',p.name) as product,sum(oi.quantity)::int as quantity,sum(oi.total_price) as revenue from order_items oi join orders o on o.id=oi.order_id left join products p on p.id=oi.product_id where o.created_at between ${from} and ${to} group by 1 order by quantity desc`),
      db.execute(sql`select coalesce(oi.specifications->>'categoryName',c.name,'Uncategorised') as category,sum(oi.quantity)::int as quantity,sum(oi.total_price) as revenue from order_items oi join orders o on o.id=oi.order_id left join products p on p.id=oi.product_id left join product_categories c on c.id=p.category_id where o.created_at between ${from} and ${to} group by 1 order by quantity desc`),
      db.execute(sql`select customer_email,count(*)::int as orders,sum(total_amount) as order_value,min(created_at) as first_order,max(created_at) as latest_order from orders where created_at between ${from} and ${to} group by customer_email order by order_value desc`),
      db.execute(sql`select oi.design_source,count(*)::int as line_items,sum(oi.quantity)::int as quantity,sum(oi.total_price) as value from order_items oi join orders o on o.id=oi.order_id where o.created_at between ${from} and ${to} group by oi.design_source order by quantity desc`),
      db.execute(sql`select o.status,count(*)::int as orders,sum(oi.quantity)::int as items from orders o join order_items oi on oi.order_id=o.id where o.created_at between ${from} and ${to} and o.status in ('order_confirmed','in_production','quality_check','print_ready','ready_for_pickup','awaiting_dispatch') group by o.status order by orders desc`),
    ])
    const sheets: Record<string, Array<Record<string, unknown>>> = {
      Summary: [{ from: fromRaw, to: toRaw, ...summary.rows[0] }], Revenue: revenue.rows, Orders: orders.rows,
      'Order Statuses': statuses.rows, Products: products.rows, Categories: categories.rows, Customers: customers.rows,
      'Design Source': sources.rows, 'Production Status': production.rows,
    }
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(sheets.Orders), { FS: ',' })
      return new NextResponse(`sep=,\n${csv}`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="analytics-${fromRaw}-to-${toRaw}.csv"` } })
    }
    const workbook = XLSX.utils.book_new()
    for (const [name, rows] of Object.entries(sheets)) {
      const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ message: 'No data for this date range.' }])
      const columns = Object.keys(rows[0] || { message: '' })
      sheet['!cols'] = columns.map((key) => ({ wch: Math.min(40, Math.max(12, key.length + 4)) }))
      columns.forEach((key, column) => rows.forEach((row, index) => { const cell = sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })]; if (!cell) return; if (/(amount|revenue|value|average|tax|shipping)/i.test(key)) { cell.t='n'; cell.v=Number(row[key] || 0); cell.z='#,##0.00' } else if (/(date|created_at|first_order|latest_order)/i.test(key) && row[key]) { cell.t='d'; cell.v=new Date(String(row[key])); cell.z='yyyy-mm-dd hh:mm' } }))
      XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31))
    }
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellDates: true })
    return new NextResponse(buffer, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="analytics-${fromRaw}-to-${toRaw}.xlsx"` } })
  } catch (error) {
    console.error('Analytics export failed', error)
    return NextResponse.json({ error: { message: error instanceof Error && /date|From|To/i.test(error.message) ? error.message : 'Analytics export could not be generated from the selected range.' } }, { status: 400 })
  }
}
