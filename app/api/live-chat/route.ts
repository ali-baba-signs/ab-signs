import { NextRequest, NextResponse } from 'next/server'
import { createHash, createHmac } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { liveChatMessages } from '@/lib/db/schema'
import { SupportError } from '@/lib/support/validation'
import { getSession } from '@/lib/auth/middleware'
import { boundedSupportBody } from '@/lib/support/request-body'
import { CHAT_ACTIONS, supportIntent } from '@/lib/support/rules'
 
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function turnRowId(messageId: string, kind: 'customer' | 'reply') {
  const bytes = createHash('sha256').update(`support-v3:${messageId}:${kind}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

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
    const allowedOrigins = new Set([
      new URL(request.url).origin,
      'https://alibabasigns.com.au',
      'https://www.alibabasigns.com.au'
    ])
    if (origin && !allowedOrigins.has(origin)) {
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
    const messageId = String(body.messageId || '')
    const pageUrl = String(body.pageUrl || 'https://alibabasigns.com.au')

    if (message.length > 2000) throw new SupportError('Messages must be at most 2,000 characters.')
    if (orderNumber.length > 80) throw new SupportError('Order ID is too long.')
    if (!sessionId || !uuid.test(sessionId)) throw new SupportError('Invalid chat session.')
    if (!messageId || !uuid.test(messageId)) {
      throw new SupportError('Website chat widget is outdated: messageId is missing or invalid.', 400)
    }

    const session = await getSession()
    const userId = session?.user?.id || null
    const customerEmail = session?.user?.email || null
    const customerName = session?.user?.name || 'Website Visitor'
    const intent = supportIntent(action, message)
    const userDisplayMsg = action ? (CHAT_ACTIONS.find(item => item.action === action)?.label || action) : message

    // This route always targets V3. The legacy /support-message URL must not
    // override it through an environment variable.
    const n8nWebhookUrl = 'https://automation.alibabasigns.com.au/webhook/support-v3-website'
    const webhookSecret = process.env.SUPPORT_WEBSITE_HMAC_SECRET
    if (!webhookSecret) throw new SupportError('Website HMAC secret is not configured on the website server.', 500)

    // HMAC covers the exact bytes passed to fetch.
    const signedBody = JSON.stringify({
      action: action === 'human_support' ? 'talk_to_team' : action,
      message: userDisplayMsg,
      messageId,
      customerId: sessionId,
      customerName,
      verifiedUserId: userId || undefined,
      verifiedEmail: customerEmail || undefined,
      orderNumber,
      pageUrl
    })
    const signature = createHmac('sha256', webhookSecret).update(signedBody).digest('hex')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    let n8nRes: Response
    try {
      n8nRes = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-support-signature-256': `sha256=${signature}`
        },
        signal: controller.signal,
        body: signedBody
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!n8nRes.ok) {
      console.error('[support-v3] Website webhook returned', n8nRes.status)
      throw new SupportError(`Support webhook returned HTTP ${n8nRes.status}.`, 502)
    }
    const n8nPayload = await n8nRes.json() as { status?: string; reply?: string; state?: string }
    if (!['sent', 'no_reply', 'suppressed'].includes(n8nPayload.status || '')) {
      throw new SupportError('Support is still processing this message. Please retry.', 503)
    }

    const botResponse = n8nPayload.status === 'sent' && typeof n8nPayload.reply === 'string'
      ? n8nPayload.reply : ''
    const requiresHuman = ['HUMAN_REQUESTED', 'HUMAN_ACTIVE'].includes(n8nPayload.state || '')
    const customerRowId = turnRowId(messageId, 'customer')
    const replyRowId = turnRowId(messageId, 'reply')
    const messagesToInsert: (typeof liveChatMessages.$inferInsert)[] = [
      { id: customerRowId, sessionId, userId, message: userDisplayMsg, isAdminMessage: false }
    ]
    if (botResponse.trim()) messagesToInsert.push({
      id: replyRowId, sessionId, userId, message: botResponse, isAdminMessage: true
    })
    await db.insert(liveChatMessages).values(messagesToInsert).onConflictDoNothing()

    const stored = await db
      .select({
        id: liveChatMessages.id,
        message: liveChatMessages.message,
        isAdminMessage: liveChatMessages.isAdminMessage
      })
      .from(liveChatMessages)
      .where(and(
        eq(liveChatMessages.sessionId, sessionId),
        inArray(liveChatMessages.id, botResponse ? [customerRowId, replyRowId] : [customerRowId])
      ))
    const inserted = stored.sort((a, b) =>
      a.id === customerRowId ? -1 : b.id === customerRowId ? 1 : 0)

    return NextResponse.json({ data: {
      intent,
      response: botResponse,
      requiresHuman,
      collectOrderId: intent === 'track_order' && !orderNumber,
      notifyTeam: requiresHuman,
      messages: inserted
    } }, { status: 201 })
  } catch (error) {
    console.error('[support-v3] Website POST failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json(
      { error: { message: error instanceof SupportError ? error.message : 'Support is temporarily unavailable.' } },
      { status: error instanceof SupportError ? error.status : 500 }
    )
  }
}
