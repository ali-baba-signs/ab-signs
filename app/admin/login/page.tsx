import { adminAuth } from '@/lib/auth/admin-auth.config'
import { adminPath } from '@/lib/auth/admin-path'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Login - Ali Baba Signs',
  description: 'Sign in to the Ali Baba Signs admin dashboard.',
}

export default async function AdminLoginPage() {
  const session = await adminAuth.api.getSession({ headers: await headers() })
  const role = (session?.user as { role?: string } | undefined)?.role

  if (session?.user && role === 'admin') redirect(adminPath())

  return <AuthForm mode="sign-in" admin />
}
