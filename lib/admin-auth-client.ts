'use client'

import { createAuthClient } from 'better-auth/react'

export const adminAuthClient = createAuthClient({ basePath: '/api/admin-auth' })
export const { useSession: useAdminSession, signOut: adminSignOut } = adminAuthClient
