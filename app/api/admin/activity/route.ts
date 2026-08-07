import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gte, ilike } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 15, 1), 50)
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset')) || 0)
  const type = request.nextUrl.searchParams.get('type')?.trim()
  const admin = request.nextUrl.searchParams.get('admin')?.trim()
  const from = request.nextUrl.searchParams.get('from')
  try {
    const conditions = [type ? eq(adminActivityLogs.entityType, type) : undefined, admin ? ilike(adminActivityLogs.adminName, `%${admin.slice(0, 100)}%`) : undefined, from && !Number.isNaN(Date.parse(from)) ? gte(adminActivityLogs.createdAt, new Date(`${from}T00:00:00`)) : undefined].filter(Boolean)
    const activity = await db.select().from(adminActivityLogs).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(adminActivityLogs.createdAt)).limit(limit + 1).offset(offset)
    return NextResponse.json({ data: { activity: activity.slice(0, limit), hasMore: activity.length > limit } })
  } catch (error) {
    console.error('Activity list failed', error)
    return NextResponse.json({ error: { code: 'ACTIVITY_LOAD_FAILED', message: 'Recent admin activity could not be loaded.' } }, { status: 500 })
  }
}
