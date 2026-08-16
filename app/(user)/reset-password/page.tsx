'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function ResetPasswordForm() {
  const search = useSearchParams()
  const token = search.get('token') || ''
  const invalid = search.get('error') === 'INVALID_TOKEN' || !token
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(invalid ? 'This reset link is invalid, expired, or has already been used.' : '')
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try {
      const response = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, newPassword: password }) })
      if (!response.ok) throw new Error('This reset link is invalid, expired, or has already been used.')
      setMessage('Password updated. You can now sign in with your new password.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Password reset failed.') } finally { setBusy(false) }
  }
  return <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm"><h1 className="text-2xl font-black">Choose a new password</h1>{error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message ? <><p role="status" className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800">{message}</p><Link href="/sign-in"><Button className="mt-5 w-full">Continue to sign in</Button></Link></> : <form className="mt-6 space-y-4" onSubmit={submit}><label className="block text-sm font-semibold">New password<Input className="mt-2" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="block text-sm font-semibold">Confirm new password<Input className="mt-2" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><Button className="w-full" type="submit" disabled={busy || invalid}>{busy ? 'Updating…' : 'Update password'}</Button></form>}{invalid && <Link href="/forgot-password" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">Request a new reset link</Link>}</section>
}

export default function ResetPasswordPage() { return <main className="grid min-h-[75vh] place-items-center px-4"><Suspense fallback={<p>Loading secure reset…</p>}><ResetPasswordForm /></Suspense></main> }
