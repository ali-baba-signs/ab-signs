import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orderItems, orders, productReviews, products, users } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('productId') || ''
  const mine = request.nextUrl.searchParams.get('mine') === 'true'
  const session = mine ? await getSession() : null
  if (mine && !session?.user) return NextResponse.json({ error: { message: 'Sign in to view your reviews.' } }, { status: 401 })
  if (!mine && !/^[0-9a-f-]{36}$/i.test(productId)) return NextResponse.json({ error: { message: 'A valid product is required.' } }, { status: 400 })
  const rows = await db.select({ review: productReviews, customerName: users.name, productName: products.name }).from(productReviews).innerJoin(users, eq(productReviews.userId, users.id)).innerJoin(products, eq(productReviews.productId, products.id)).where(mine ? eq(productReviews.userId, session!.user.id) : and(eq(productReviews.productId, productId), eq(productReviews.moderationStatus, 'published'))).orderBy(desc(productReviews.createdAt))
  const reviews = rows.map(({ review, customerName, productName }) => { const parts = customerName.trim().split(/\s+/); const displayName = parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : parts[0]; return { ...review, displayName, productName } })
  const distribution = Object.fromEntries([1,2,3,4,5].map((rating) => [rating, reviews.filter((row) => row.overall === rating).length]))
  const overallRating = reviews.length ? reviews.reduce((sum,row)=>sum+row.overall,0)/reviews.length : 0
  return NextResponse.json({ data: { reviews, summary: { overallRating, count: reviews.length, distribution } } }, { headers: { 'cache-control': mine ? 'private, no-store' : 'public, max-age=60' } })
}

export async function POST(request:NextRequest){const session=await getSession();if(!session?.user)return NextResponse.json({error:{message:'Sign in to submit a review.'}},{status:401});try{const body=await request.json() as Record<string,unknown>;const itemId=typeof body.orderItemId==='string'?body.orderItemId:'';const[item]=await db.select().from(orderItems).where(eq(orderItems.id,itemId)).limit(1);if(!item)throw new Error('Order item not found.');const[order]=await db.select().from(orders).where(and(eq(orders.id,item.orderId),eq(orders.userId,session.user.id))).limit(1);if(!order)throw new Error('This order does not belong to you.');if(!['delivered','completed'].includes(order.status))throw new Error('Reviews open only after delivery.');const rating=(key:string)=>{const value=Math.floor(Number(body[key]));if(value<1||value>5)throw new Error('All ratings must be between 1 and 5.');return value};const[review]=await db.insert(productReviews).values({orderItemId:item.id,orderId:order.id,userId:session.user.id,productId:item.productId,productQuality:rating('productQuality'),printQuality:rating('printQuality'),colourFinishQuality:rating('colourFinishQuality'),timeliness:rating('timeliness'),service:rating('service'),overall:rating('overall'),feedback:typeof body.feedback==='string'?body.feedback.trim().slice(0,5000):'',verifiedPurchase:true}).returning();return NextResponse.json({data:{review}},{status:201})}catch(error){const duplicate=error instanceof Error&&/unique|duplicate/i.test(error.message);return NextResponse.json({error:{message:duplicate?'A review already exists for this order item.':error instanceof Error?error.message:'Review submission failed.'}},{status:duplicate?409:400})}}
