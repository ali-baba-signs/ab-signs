import { AsyncLocalStorage } from 'node:async_hooks'

export type AuthEmailDeliveryFailure = {
  code: 'EMAIL_DELIVERY_FAILED'
  message: string
}

export type AuthEmailKind = 'verification' | 'password-reset' | 'login-code'

type DeliveryContext = { failure?: AuthEmailDeliveryFailure }

const deliveryContext = new AsyncLocalStorage<DeliveryContext>()

function smtpDetails(error: unknown) {
  const value = error as { code?: unknown; responseCode?: unknown; command?: unknown; message?: unknown }
  return {
    code: typeof value?.code === 'string' ? value.code.replace(/[^A-Z0-9_-]/gi, '').slice(0, 40) : '',
    responseCode: Number.isInteger(value?.responseCode) ? Number(value.responseCode) : 0,
    command: typeof value?.command === 'string' ? value.command.replace(/[^A-Z0-9_-]/gi, '').slice(0, 40) : '',
    message: typeof value?.message === 'string' ? value.message : '',
  }
}

export function friendlyAuthEmailError(kind: AuthEmailKind, error: unknown): AuthEmailDeliveryFailure {
  const details = smtpDetails(error)
  let reason = 'The mail server did not accept the verification email.'

  if (/Mail delivery is not configured/i.test(details.message)) reason = details.message
  else if (details.code === 'EAUTH' || details.responseCode === 535) reason = 'SMTP authentication failed. Check the local SMTP username and password.'
  else if (details.code === 'ETIMEDOUT' || details.code === 'ECONNECTION' || details.code === 'ECONNREFUSED') reason = 'The local server could not connect to SMTP before the timeout.'
  else if (details.code === 'ETLS' || /certificate|tls|ssl/i.test(details.message)) reason = 'The SMTP TLS connection failed. Check the local port, secure, and TLS settings.'
  else if (details.code === 'EENVELOPE' || details.responseCode >= 500) reason = `The mail server rejected the verification email${details.responseCode ? ` (SMTP ${details.responseCode})` : ''}. Check the recipient and sender addresses.`

  const reference = [details.code, details.command].filter(Boolean).join('/')
  const introduction = kind === 'verification'
    ? 'Your account was created, but the verification email was not delivered.'
    : kind === 'password-reset'
      ? 'The password-reset email was not delivered.'
      : 'The login verification code was not delivered.'
  return {
    code: 'EMAIL_DELIVERY_FAILED',
    message: `${introduction} ${reason}${reference ? ` Reference: ${reference}.` : ''} Check the local email setting, then retry.`,
  }
}

export function captureAuthEmailDeliveryFailure(kind: AuthEmailKind, error: unknown) {
  const context = deliveryContext.getStore()
  if (context && !context.failure) context.failure = friendlyAuthEmailError(kind, error)
}

export async function withAuthEmailDeliveryCapture<T>(operation: () => Promise<T>) {
  const context: DeliveryContext = {}
  const value = await deliveryContext.run(context, operation)
  return { value, failure: context.failure }
}
