import { auth } from '@/lib/auth/auth.config'
import { withAuthEmailDeliveryCapture } from '@/lib/auth/email-delivery'
import { toNextJsHandler } from 'better-auth/next-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const handlers = toNextJsHandler(auth.handler)

export const GET = handlers.GET

export async function POST(request: Request) {
  const { value: response, failure } = await withAuthEmailDeliveryCapture(() => handlers.POST(request))
  if (!failure) return response
  return NextResponse.json(failure, { status: 502, headers: { 'cache-control': 'private, no-store' } })
}
