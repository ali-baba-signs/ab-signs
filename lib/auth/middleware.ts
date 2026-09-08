import { auth } from '@/lib/auth/auth.config'
import { headers } from 'next/headers'

export async function getSession(request?: Request) {
  const headersList = request?.headers ?? await headers()

  const session = await auth.api.getSession({
    headers: headersList,
  })

  return session
}
