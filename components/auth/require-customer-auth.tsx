'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'

export function RequireCustomerAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending && !session?.user) {
      const destination = `${window.location.pathname}${window.location.search}`
      router.replace(`/sign-in?callbackUrl=${encodeURIComponent(destination)}`)
    }
  }, [isPending, router, session?.user])

  if (isPending || !session?.user) {
    return <div className="grid min-h-[70vh] place-items-center">Checking your account…</div>
  }

  return children
}
