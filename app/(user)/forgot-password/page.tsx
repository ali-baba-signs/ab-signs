'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      await fetch('/api/auth/request-password-reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` }) })
      setMessage('If an account exists for that email, a secure reset link has been sent. Check your inbox and spam folder.')
    } finally { setBusy(false) }
  }
  return <main className="grid min-h-[75vh] place-items-center px-4"><section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm"><h1 className="text-2xl font-black">Reset your password</h1><p className="mt-2 text-sm text-muted-foreground">Enter the email used for your customer account.</p><form className="mt-6 space-y-4" onSubmit={submit}><label className="block text-sm font-semibold">Email address<Input className="mt-2" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><Button className="w-full" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button></form>{message && <p role="status" className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800">{message}</p>}<Link href="/sign-in" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">Back to sign in</Link></section></main>
}
