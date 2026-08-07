import 'server-only'

import { headers } from 'next/headers'
import { adminAuth } from '@/lib/auth/admin-auth.config'
import { getUserRole } from '@/lib/auth/roles'

export async function getAdminSession() {
  const session = await adminAuth.api.getSession({ headers: await headers() })
  if (!session?.user || getUserRole(session.user) !== 'admin') return null
  return session
}

export type AdminSession = NonNullable<Awaited<ReturnType<typeof getAdminSession>>>
