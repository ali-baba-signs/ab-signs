import 'server-only'

import nodemailer from 'nodemailer'

export interface ContactEmailInput {
  id: string
  name: string
  email: string
  phone?: string | null
  company?: string | null
  orderNumber?: string | null
  enquiryType?: string | null
  subject: string
  message: string
  recipient: string
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Mail delivery is not configured: ${name} is missing.`)
  return value
}

function smtpUser() {
  const value = process.env.SMTP_USER?.trim() || process.env.SMTP_USERNAME?.trim()
  if (!value) throw new Error('Mail delivery is not configured: SMTP_USER is missing.')
  if (/your-mailbox@|example\.(com|org)|placeholder/i.test(value)) throw new Error('Mail delivery is not configured: SMTP_USER contains a placeholder value.')
  return value
}

function booleanEnvironment(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return fallback
  if (!['true', 'false'].includes(value)) throw new Error(`Mail delivery is not configured: ${name} must be true or false.`)
  return value === 'true'
}

function timeoutEnvironment(name: string, fallback: number) {
  const value = process.env[name]?.trim()
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 120000) throw new Error(`Mail delivery is not configured: ${name} must be between 1000 and 120000.`)
  return parsed
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!)
}

function transport() {
  const port = Number(requiredEnvironment('SMTP_PORT'))
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Mail delivery is not configured: SMTP_PORT is invalid.')
  return nodemailer.createTransport({
    host: requiredEnvironment('SMTP_HOST'),
    port,
    secure: booleanEnvironment('SMTP_SECURE', port === 465),
    requireTLS: booleanEnvironment('SMTP_REQUIRE_TLS', false),
    auth: { user: smtpUser(), pass: requiredEnvironment('SMTP_PASSWORD') },
    connectionTimeout: timeoutEnvironment('SMTP_CONNECTION_TIMEOUT_MS', 10_000),
    greetingTimeout: timeoutEnvironment('SMTP_GREETING_TIMEOUT_MS', 10_000),
    socketTimeout: timeoutEnvironment('SMTP_SOCKET_TIMEOUT_MS', 20_000),
  })
}

export function validateMailConfiguration() {
  requiredEnvironment('SMTP_HOST')
  requiredEnvironment('SMTP_PORT')
  smtpUser()
  requiredEnvironment('SMTP_PASSWORD')
  requiredEnvironment('SMTP_FROM_EMAIL')
}

export async function sendPasswordResetEmail(input: { email: string; name: string; url: string }) {
  validateMailConfiguration()
  const fromEmail = requiredEnvironment('SMTP_FROM_EMAIL')
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Ali Baba Signs'
  await transport().sendMail({
    from: { name: fromName, address: fromEmail },
    to: input.email,
    subject: 'Reset your Ali Baba Signs password',
    text: `Hi ${input.name || 'there'},\n\nUse this secure, single-use link to reset your password. It expires in one hour:\n${input.url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${escapeHtml(input.name || 'there')},</p><p>Use the secure, single-use link below to reset your password. It expires in one hour.</p><p><a href="${escapeHtml(input.url)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  })
}

export async function sendContactEmail(input: ContactEmailInput) {
  const fromEmail = requiredEnvironment('SMTP_FROM_EMAIL')
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Ali Baba Signs Website'
  const fields = [
    ['Name', input.name], ['Email', input.email], ['Phone', input.phone], ['Company', input.company],
    ['Order number', input.orderNumber], ['Enquiry type', input.enquiryType], ['Submission ID', input.id],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))
  await transport().sendMail({
    from: { name: fromName, address: fromEmail },
    to: input.recipient,
    replyTo: { name: input.name, address: input.email },
    subject: `[Website enquiry] ${input.subject.replace(/[\r\n]+/g, ' ')}`,
    text: `${fields.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${input.message}`,
    html: `<h2>New website enquiry</h2><dl>${fields.map(([label, value]) => `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl><h3>${escapeHtml(input.subject)}</h3><p>${escapeHtml(input.message).replace(/\r?\n/g, '<br>')}</p>`,
  })

  if (process.env.SMTP_SEND_ACKNOWLEDGEMENT?.toLowerCase() === 'true') {
    await transport().sendMail({
      from: { name: fromName, address: fromEmail },
      to: input.email,
      subject: 'We received your enquiry — Ali Baba Signs',
      text: `Hi ${input.name},\n\nThanks for contacting Ali Baba Signs. We have received your enquiry and will respond as soon as possible.\n\nReference: ${input.id}`,
    })
  }
}

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string; html: string }) {
  validateMailConfiguration()
  const fromEmail = requiredEnvironment('SMTP_FROM_EMAIL')
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Ali Baba Signs'
  const result = await transport().sendMail({ from: { name: fromName, address: fromEmail }, ...input })
  return result.messageId || null
}
