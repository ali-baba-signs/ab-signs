import { NextResponse } from 'next/server'
import { desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orderItems, orders, productReviews, products, users } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  const reviews = await db.select().from(productReviews).orderBy(desc(productReviews.createdAt))
  const productIds = [...new Set(reviews.map((review) => review.productId))]
  const userIds = [...new Set(reviews.map((review) => review.userId))]
  const itemIds = [...new Set(reviews.map((review) => review.orderItemId))]
  const [productRows, userRows, itemRows] = await Promise.all([productIds.length ? db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds)) : [], userIds.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [], itemIds.length ? db.select().from(orderItems).where(inArray(orderItems.id, itemIds)) : []])
  const orderIds = [...new Set(itemRows.map((item) => item.orderId))]
  const orderRows = orderIds.length ? await db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders).where(inArray(orders.id, orderIds)) : []
  return NextResponse.json({ data: { reviews: reviews.map((review) => { const item = itemRows.find((row) => row.id === review.orderItemId); return { ...review, productName: productRows.find((row) => row.id === review.productId)?.name || 'Product', customerName: userRows.find((row) => row.id === review.userId)?.name || 'Customer', orderNumber: orderRows.find((row) => row.id === item?.orderId)?.orderNumber || '' } }) } }, { headers: { 'cache-control': 'no-store' } })
}
