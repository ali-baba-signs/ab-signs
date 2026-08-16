import { desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { contactSubmissions } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { message: 'Admin access is required.' } }, { status: 401 })
  const enquiries = await db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt)).limit(500)
  return NextResponse.json({ data: { enquiries } }, { headers: { 'cache-control': 'private, no-store' } })
}
