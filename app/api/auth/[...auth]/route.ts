import { auth } from '@/lib/auth/auth.config'
import { withAuthEmailDeliveryCapture } from '@/lib/auth/email-delivery'
import { toNextJsHandler } from 'better-auth/next-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const handlers = toNextJsHandler(auth.handler)

export const GET = handlers.GET

export async function POST(request: Request) {
  // if (localMfaBypass) {
  //   const urls = [request.url, request.headers.get('origin')].filter((value): value is string => Boolean(value))
  //   if (urls.some((value) => {
  //     try { return !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname) } catch { return true }
  //   })) return NextResponse.json({ code: 'LOCAL_AUTH_ONLY', message: 'Local development authentication is available only on localhost.' }, { status: 403 })
  // }
  const { value: response, failure } = await withAuthEmailDeliveryCapture(() => handlers.POST(request))
  if (!failure) return response
  return NextResponse.json(failure, { status: 502, headers: { 'cache-control': 'private, no-store' } })
}
