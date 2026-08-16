import { NextRequest, NextResponse } from 'next/server'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { liveChatMessages, users } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'

export async function GET(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 })
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (sessionId) {
    const messages = await db.select().from(liveChatMessages).where(eq(liveChatMessages.sessionId, sessionId)).orderBy(asc(liveChatMessages.createdAt))
    return NextResponse.json({ data: { messages } })
  }
  const rows = await db.select({ id: liveChatMessages.id, sessionId: liveChatMessages.sessionId, userId: liveChatMessages.userId, message: liveChatMessages.message, isAdminMessage: liveChatMessages.isAdminMessage, createdAt: liveChatMessages.createdAt, userName: users.name, userEmail: users.email }).from(liveChatMessages).leftJoin(users, eq(liveChatMessages.userId, users.id)).orderBy(desc(liveChatMessages.createdAt)).limit(500)
  const seen = new Set<string>(); const sessions = rows.filter((row) => { if (seen.has(row.sessionId)) return false; seen.add(row.sessionId); return true })
  return NextResponse.json({ data: { sessions } })
}

export async function POST(request: NextRequest) {
  try {
    if (!await getAdminSession()) return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 401 })
    const body = await request.json() as { sessionId?: string; message?: string }
    const message = body.message?.trim()
    if (!body.sessionId || !message || message.length > 2000) throw new Error('Enter a reply of up to 2,000 characters.')
    // The legacy table has no admin sender column and requires a users(id) FK.
    // Store the customer owner for referential integrity; is_admin_message marks the reply.
    const [owner] = await db.select({ userId: liveChatMessages.userId }).from(liveChatMessages).where(eq(liveChatMessages.sessionId, body.sessionId)).limit(1)
    if (!owner) return NextResponse.json({ error: { message: 'Conversation not found.' } }, { status: 404 })
    const [row] = await db.insert(liveChatMessages).values({ sessionId: body.sessionId, userId: owner.userId, message, isAdminMessage: true }).returning()
    return NextResponse.json({ data: { message: row } }, { status: 201 })
  } catch (error) { return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Reply could not be sent.' } }, { status: 400 }) }
}
