import { auth } from '@/lib/auth/auth.config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up - Ali Baba Signs',
  description: 'Create a new Ali Baba Signs account to start designing custom banners and vinyl designs.',
}

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/')

  return <AuthForm mode="sign-up" />
}
