'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(() => searchParams.get('verified') === '1' ? 'Email verified. Sign in to continue.' : null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials')
  const [code, setCode] = useState('')
  const [resendAvailableAt, setResendAvailableAt] = useState(0)
  const [countdown, setCountdown] = useState(0)

  const isSignUp = mode === 'sign-up'
  const callbackURL = useMemo(() => {
    const value = searchParams.get('callbackUrl')
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
  }, [searchParams])

  useEffect(() => {
    if (!resendAvailableAt) return
    const update = () => setCountdown(Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [resendAvailableAt])

  async function sendMfaCode() {
    const result = await authClient.twoFactor.sendOtp()
    if (result.error) throw new Error(result.error.message || 'The verification code could not be sent.')
    setResendAvailableAt(Date.now() + 30_000)
  }

  async function resendVerificationEmail() {
    if (!email || loading) return
    setLoading(true); setError(null); setSuccess(null)
    const result = await authClient.sendVerificationEmail({ email, callbackURL: '/sign-in?verified=1' })
    if (result.error) setError(result.error.message || 'The verification email could not be resent.')
    else setSuccess('Verification email sent. Check your inbox and spam folder.')
    setLoading(false)
  }

  async function verifyMfa(event: React.FormEvent) {
    event.preventDefault()
    if (loading) return
    setLoading(true); setError(null)
    try {
      const result = await authClient.twoFactor.verifyOtp({ code })
      if (result.error) throw new Error(result.error.message || 'The verification code is invalid or expired.')
      setSuccess('Login successful.')
      router.push(callbackURL)
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The verification code could not be checked.')
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const result = admin
        ? await adminAuthClient.signIn.email({ email, password })
        : isSignUp
          ? await authClient.signUp.email({ email, password, name, callbackURL: '/sign-in?verified=1' })
          : await authClient.signIn.email({ email, password })
      const { error } = result

      if (error) {
        const message = error.message ?? 'Could not complete the request. Check the email and password.'
        setError((error as { code?: string }).code === 'EMAIL_NOT_VERIFIED' ? 'Verify your email address before signing in.' : message)
        setLoading(false)
        return
      }

      if (!admin && !isSignUp && (result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        await sendMfaCode()
        setStep('mfa')
        setSuccess('A six-digit code was sent to your email address.')
        setLoading(false)
        return
      }

      setSuccess(isSignUp ? 'Check your email to activate your account. You cannot sign in until verification succeeds.' : 'Login successful.')
      setLoading(false)

      if (!isSignUp) setTimeout(() => {
        router.push(admin ? adminPath() : callbackURL)
        router.refresh()
      }, 600)
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
            {admin ? 'Admin Sign In' : step === 'mfa' ? 'Check Your Email' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {admin
              ? 'Sign in with an Ali Baba Signs admin account'
              : step === 'mfa'
                ? `Enter the six-digit code sent to ${email}`
              : isSignUp
                ? 'Sign up to start creating custom designs'
                : 'Sign in to your Ali Baba Signs account'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <form onSubmit={step === 'mfa' ? verifyMfa : handleSubmit} className="flex flex-col gap-4">
            {step === 'mfa' ? <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mfa-code" className="text-foreground font-medium">Verification code</Label>
                <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="h-12 text-center text-xl font-bold tracking-[0.35em]" required autoFocus />
                <p className="text-xs text-muted-foreground">The code expires after five minutes.</p>
              </div>
            </> : <>
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
            </>}

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
                  {step === 'mfa' ? 'Verifying code...' : isSignUp ? 'Sending verification email...' : 'Checking password...'}
                </span>
              ) : step === 'mfa' ? (
                'Verify & Sign In'
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </Button>
            {step === 'mfa' && <div className="flex items-center justify-between gap-3 text-sm"><button type="button" className="font-semibold text-primary hover:underline disabled:text-muted-foreground" disabled={loading || countdown > 0} onClick={() => void sendMfaCode().then(() => setSuccess('A new verification code was sent.')).catch((reason) => setError(reason instanceof Error ? reason.message : 'The code could not be resent.'))}>{countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}</button><button type="button" className="font-semibold hover:underline" onClick={() => { setStep('credentials'); setCode(''); setError(null); setSuccess(null) }}>Use another account</button></div>}
            {!admin && !isSignUp && step === 'credentials' && error?.toLowerCase().includes('verify your email') && <Button type="button" variant="outline" onClick={() => void resendVerificationEmail()} disabled={loading}>Resend verification email</Button>}
          </form>

          {!admin && step === 'credentials' && (
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
          <Link href="/terms-of-service" className="underline hover:text-foreground">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy-policy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  )
}
