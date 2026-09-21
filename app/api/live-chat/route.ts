import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { liveChatMessages } from '@/lib/db/schema'
import { SupportError } from '@/lib/support/validation'
import { getSession } from '@/lib/auth/middleware'
import { boundedSupportBody } from '@/lib/support/request-body'
import { CHAT_ACTIONS, supportIntent } from '@/lib/support/rules'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const session = await getSession()
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId || !uuid.test(sessionId)) return NextResponse.json({ data: { messages: [] } })

  const query = session?.user
    ? and(eq(liveChatMessages.sessionId, sessionId), eq(liveChatMessages.userId, session.user.id))
    : eq(liveChatMessages.sessionId, sessionId)

  const messages = await db
    .select()
    .from(liveChatMessages)
    .where(query)
    .orderBy(asc(liveChatMessages.createdAt))

  return NextResponse.json({ data: { messages } })
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin && origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) {
      throw new SupportError('Request origin is not allowed.', 403)
    }

    const text = await boundedSupportBody(request, 32768).text()
    let body: Record<string, unknown>
    try { body = JSON.parse(text) } catch { throw new SupportError('Invalid support request.') }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SupportError('Invalid support request.')

    const message = String(body.message || '').trim()
    const action = String(body.action || '')
    const orderNumber = String(body.orderNumber || '').trim()
    const sessionId = String(body.sessionId || '')
    const pageUrl = String(body.pageUrl || 'https://alibabasigns.com.au')

    if (message.length > 2000) throw new SupportError('Messages must be at most 2,000 characters.')
    if (orderNumber.length > 80) throw new SupportError('Order ID is too long.')
    if (!sessionId || !uuid.test(sessionId)) throw new SupportError('Invalid chat session.')

    // Get session context (if logged in)
    const session = await getSession()
    const userId = session?.user?.id || null
    const customerEmail = session?.user?.email || null
    const customerName = session?.user?.name || 'Website Visitor'

    // Check intent for action labels
    const intent = supportIntent(action, message)
    const userDisplayMsg = action ? (CHAT_ACTIONS.find(item => item.action === action)?.label || action) : message

    // Route request to n8n Webhook
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://automation.alibabasigns.com.au/webhook/support-message'
    const webhookSecret = process.env.SUPPORT_WEBHOOK_SECRET

    if (!webhookSecret) {
      throw new SupportError(
        'Webhook configuration error.',
        500
      )
    }
const controller = new AbortController()

const timeout = setTimeout(() => {
  controller.abort()
},10000)


const n8nRes = await fetch(n8nWebhookUrl,{
  method:'POST',
  headers:{
    'content-type':'application/json',
    'x-webhook-secret': webhookSecret
  },
  signal: controller.signal,
  body: JSON.stringify({
    action,
    message:userDisplayMsg,
    orderNumber,
    customerName,
    customerEmail,
    sessionId,
    pageUrl
  })
})


clearTimeout(timeout)

    if (!n8nRes.ok) {
      throw new SupportError('Support automation is currently unavailable.', 502)
    }

    const n8nPayload = await n8nRes.json()

    const botResponse = n8nPayload.reply || 'Thanks for contacting Alibaba Signs. We are reviewing your message.'
    const detectedIntent = n8nPayload.intent || intent
    const requiresHuman = Boolean(n8nPayload.wantsHuman || n8nPayload.priority === 'HIGH')
    const collectOrderId = detectedIntent === 'orderStatus' && !orderNumber

    // Persist turn in Neon DB for admin panel review
    const inserted = await db.insert(liveChatMessages).values([
      { sessionId, userId, message: userDisplayMsg, isAdminMessage: false },
      { sessionId, userId, message: botResponse, isAdminMessage: true }
    ]).returning({
      id: liveChatMessages.id,
      message: liveChatMessages.message,
      isAdminMessage: liveChatMessages.isAdminMessage
    })

    return NextResponse.json({
      data: {
        intent: detectedIntent,
        response: botResponse,
        requiresHuman,
        collectOrderId,
        notifyTeam: Boolean(
  n8nPayload.notifyTeam ||
  n8nPayload.priority === 'URGENT - ACTION REQUIRED' ||
  n8nPayload.priority === 'HIGH'
),
        messages: inserted
      }
    }, { status: 201 })

  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof SupportError ? error.message : 'Support is temporarily unavailable.' } },
      { status: error instanceof SupportError ? error.status : 500 }
    )
  }
}