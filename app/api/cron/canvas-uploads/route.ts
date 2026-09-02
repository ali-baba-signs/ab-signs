import { NextRequest, NextResponse } from 'next/server'
import { cleanupAbandonedCanvasUploads } from '@/lib/storage/canvas-upload-cleanup'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cleanup is not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    return NextResponse.json({ data: await cleanupAbandonedCanvasUploads() })
  } catch (error) {
    console.error('Canvas upload cleanup failed', error)
    return NextResponse.json({ error: 'Canvas upload cleanup failed.' }, { status: 500 })
  }
}
