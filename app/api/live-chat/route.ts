import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { liveChatMessages } from '@/lib/db/schema'
import { processSupportMessage, verifiedSupportOrder } from '@/lib/support/handler'
import { SupportError, validateSupportMessage } from '@/lib/support/validation'
import { getSession } from '@/lib/auth/middleware'
import { boundedSupportBody } from '@/lib/support/request-body'
import { CHAT_ACTIONS, ruleReply, supportIntent } from '@/lib/support/rules'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export async function GET(request: NextRequest) {
  const session = await getSession()
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!session?.user) return NextResponse.json({ error: { message: 'Sign in to use support chat.' } }, { status: 401 })
  if (!sessionId || !uuid.test(sessionId)) return NextResponse.json({ data: { messages: [] } })
  const messages = await db.select().from(liveChatMessages).where(and(eq(liveChatMessages.sessionId, sessionId), eq(liveChatMessages.userId, session.user.id))).orderBy(asc(liveChatMessages.createdAt))
  return NextResponse.json({ data: { messages } })
}
export async function POST(request: NextRequest) {
  try {
    const origin=request.headers.get('origin')
    if(origin && origin!==new URL(request.url).origin && origin!==new URL(process.env.NEXT_PUBLIC_SITE_URL||request.url).origin)throw new SupportError('Request origin is not allowed.',403)
    const text=await boundedSupportBody(request,32768).text()
    let body: Record<string,unknown>
    try { body=JSON.parse(text) } catch { throw new SupportError('Invalid support request.') }
    if(!body||typeof body!=='object'||Array.isArray(body))throw new SupportError('Invalid support request.')
    for(const key of ['action','message','orderNumber','sessionId','pageUrl'])if(body[key]!==undefined&&typeof body[key]!=='string')throw new SupportError('Invalid support request.')
    const message=String(body.message||'').trim(), action=String(body.action||'')
    if(message.length>2000)throw new SupportError('Messages must be at most 2,000 characters.')
    if(action && ![...CHAT_ACTIONS.map(item=>String(item.action)),'payment','complaint','urgent'].includes(action))throw new SupportError('Invalid support action.')
    const intent=supportIntent(action,message)
    const reply=ruleReply(intent)
    const orderNumber=String(body.orderNumber||'').trim()
    if(orderNumber.length>80)throw new SupportError('Order ID is too long.')
    // Button prompts and FAQs do not need a session, database write or webhook.
    if(intent!=='track_order' && (!reply.requiresHuman || !message || intent==='custom_quote'))return NextResponse.json({data:reply})
    if(intent==='track_order'&&!orderNumber)return NextResponse.json({data:reply})
    const session=await getSession()
    if(!session?.user)throw new SupportError('Sign in to submit a request or view private order tracking. You can also use /contact.',401)
    const identity={id:session.user.id,email:session.user.email,emailVerified:session.user.emailVerified}
    const support=validateSupportMessage({customerName:session.user.name,customerEmail:session.user.email,action:intent,message:message||'Please check my order status.',category:intent==='track_order'?'Order status':intent==='payment'?'Payment issue':'General enquiry',orderNumber,pageUrl:body.pageUrl})
    if(intent==='track_order') {
      const order=await verifiedSupportOrder(support,identity)
      return NextResponse.json({data:{...reply,collectOrderId:!order,order:order||null,response:order?`${order.status}. Tracking number: ${order.trackingNumber||'Not assigned yet'}. Delivery estimate: ${order.deliveryEstimate?new Date(order.deliveryEstimate).toLocaleDateString('en-AU',{timeZone:'Australia/Melbourne'}):'Not available yet'}. ${order.nextStep}`:'We could not verify this order for your account. Check the order ID and sign in with the verified order email.'}},{headers:{'cache-control':'no-store'}})
    }
    const sessionId=String(body.sessionId||'')
    if(!uuid.test(sessionId))throw new SupportError('Invalid chat session.')
    const result=await processSupportMessage(support,request,identity)
    const messages=await db.insert(liveChatMessages).values([{sessionId,userId:identity.id,message,isAdminMessage:false},{sessionId,userId:identity.id,message:result.message,isAdminMessage:true}]).returning({id:liveChatMessages.id,message:liveChatMessages.message,isAdminMessage:liveChatMessages.isAdminMessage})
    return NextResponse.json({data:{...reply,response:result.message,messages}},{status:201})
  } catch(error) {
    return NextResponse.json({error:{message:error instanceof SupportError?error.message:'Support is temporarily unavailable.'}},{status:error instanceof SupportError?error.status:503})
  }
}
