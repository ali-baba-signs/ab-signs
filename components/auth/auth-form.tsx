'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { adminAuthClient } from '@/lib/admin-auth-client'
import { adminPath } from '@/lib/auth/admin-path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthForm({
  mode,
  admin = false,
}: {
  mode: 'sign-in' | 'sign-up'
  admin?: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'sign-up'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const client = admin ? adminAuthClient : authClient
      const { error } = isSignUp
        ? await client.signUp.email({ email, password, name })
        : await client.signIn.email({ email, password })

      if (error) {
        setError(error.message ?? 'Could not complete the request. Check the email, password, and server console.')
        setLoading(false)
        return
      }

      setSuccess(isSignUp ? 'Account created successfully.' : 'Login successful.')
      setLoading(false)

      setTimeout(() => {
        router.push(admin ? adminPath() : '/')
        router.refresh()
      }, 1400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      {(error || success) && (
        <div className="fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div
            className={`rounded-md border px-4 py-3 text-sm font-semibold shadow-lg ${
              error
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
            role={error ? 'alert' : 'status'}
          >
            {error ?? success}
          </div>
        </div>
      )}
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Image src="/blogo.png" alt="Ali Baba Signs" width={220} height={72} priority className="h-24 w-auto" />
          </Link>
          <h1 className="text-3xl font-bold text-foreground">
            {admin ? 'Admin Sign In' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {admin
              ? 'Sign in with an Ali Baba Signs admin account'
              : isSignUp
                ? 'Sign up to start creating custom designs'
                : 'Sign in to your Ali Baba Signs account'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignUp && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name" className="text-foreground font-medium">
                  Full Name
                </Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isSignUp}
                  autoComplete="name"
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-foreground font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                {isSignUp ? 'Minimum 8 characters' : ''}
              </p>
              {!admin && !isSignUp && <Link href="/forgot-password" className="self-end text-sm font-semibold text-primary hover:underline">Forgot password?</Link>}
            </div>

            {error && (
              <div
                className="bg-red-50 border border-red-200 rounded-md p-3"
                role="alert"
              >
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {success && (
              <div
                className="bg-green-50 border border-green-200 rounded-md p-3"
                role="status"
              >
                <p className="text-sm text-green-700 font-medium">{success}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-opacity-90 text-white font-medium py-2 rounded-md transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {isSignUp ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {!admin && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-card text-muted-foreground">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  </span>
                </div>
              </div>

              <Link
                href={isSignUp ? '/sign-in' : '/sign-up'}
                className="w-full inline-flex items-center justify-center border border-border bg-background hover:bg-secondary text-foreground font-medium py-2 px-4 rounded-md transition-colors"
              >
                {isSignUp ? 'Sign In Instead' : 'Create New Account'}
              </Link>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          By {isSignUp ? 'signing up' : 'signing in'}, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  )
}
