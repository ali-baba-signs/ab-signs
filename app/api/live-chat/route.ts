import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { liveChatMessages } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'

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
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: { message: 'Sign in to use support chat.' } }, { status: 401 })
    const body = await request.json() as { sessionId?: string; message?: string }
    const message = body.message?.trim()
    if (!body.sessionId || !uuid.test(body.sessionId) || !message || message.length > 2000) throw new Error('Enter a support message of up to 2,000 characters.')
    const [row] = await db.insert(liveChatMessages).values({ sessionId: body.sessionId, userId: session.user.id, message, isAdminMessage: false }).returning()
    return NextResponse.json({ data: { message: row } }, { status: 201 })
  } catch (error) { return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Message could not be sent.' } }, { status: 400 }) }
}
