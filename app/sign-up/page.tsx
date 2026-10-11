import { auth } from '@/lib/auth/auth.config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import type { Metadata } from 'next'
import { safeCallbackUrl } from '@/lib/auth/callback-url'

export const metadata: Metadata = {
  title: 'Sign Up - Ali Baba Signs',
  description: 'Create a new Ali Baba Signs account to start designing custom banners and vinyl designs.',
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    const callbackUrl = (await searchParams).callbackUrl
    redirect(safeCallbackUrl(typeof callbackUrl === 'string' ? callbackUrl : null))
  }

  return <AuthForm mode="sign-up" />
}
