import { adminAuth } from '@/lib/auth/admin-auth.config'
import { migrateAdminPlaintextPassword } from '@/lib/auth/admin-password-migration'
import { toNextJsHandler } from 'better-auth/next-js'
import { NextResponse } from 'next/server'

const handlers = toNextJsHandler(adminAuth)

export const GET = handlers.GET

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/\/$/, '')

  if (pathname.endsWith('/sign-in/email')) {
    const body = await request.clone().json().catch(() => null) as unknown

    if (
      body
      && typeof body === 'object'
      && 'email' in body
      && 'password' in body
      && typeof body.email === 'string'
      && typeof body.password === 'string'
    ) {
      const migration = await migrateAdminPlaintextPassword(body.email, body.password)
      if (migration === 'invalid-legacy-password') {
        return NextResponse.json(
          { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
          { status: 401 },
        )
      }
    }
  }

  return handlers.POST(request)
}
