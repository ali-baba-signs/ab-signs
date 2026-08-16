import { createHash } from 'node:crypto'
import { and, count, eq, gte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { contactSubmissions } from '@/lib/db/schema'
import { sendContactEmail } from '@/lib/contact/mailer'
import { loadStoreSettings } from '@/lib/store/load-settings'

class ContactError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'INVALID_CONTACT') { super(message) }
}

function requestIp(request: NextRequest) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export async function POST(request: NextRequest) {
  let submissionId: string | null = null
  try {
    const input = await request.json() as Record<string, unknown>
    const value = (key: string, max: number) => typeof input[key] === 'string' ? input[key].trim().slice(0, max) : ''
    if (value('website', 200)) return NextResponse.json({ data: { message: 'Message received.' } }, { status: 201 })

    const name = value('name', 255)
    const email = value('email', 255).toLowerCase()
    const phone = value('phone', 30)
    const company = value('company', 255)
    const orderNumber = value('orderNumber', 80)
    const enquiryType = value('enquiryType', 80)
    const subject = value('subject', 255)
    const message = value('message', 5000)
    if (name.length < 2) throw new ContactError('Enter your name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ContactError('Enter a valid email address.')
    if (phone && !/^[+()\-\s0-9]{6,30}$/.test(phone)) throw new ContactError('Enter a valid phone number or leave it blank.')
    if (!enquiryType) throw new ContactError('Select an enquiry type.')
    if (subject.length < 3) throw new ContactError('Enter a subject.')
    if (message.length < 10) throw new ContactError('Message must contain at least 10 characters.')

    const ipHash = createHash('sha256').update(`${process.env.CONTACT_RATE_LIMIT_SALT || 'ali-baba-signs-contact'}:${requestIp(request)}`).digest('hex')
    const since = new Date(Date.now() - 15 * 60 * 1000)
    const [recent] = await db.select({ value: count() }).from(contactSubmissions).where(and(eq(contactSubmissions.ipHash, ipHash), gte(contactSubmissions.createdAt, since)))
    if (Number(recent?.value || 0) >= 5) throw new ContactError('Too many enquiries were submitted from this connection. Please wait 15 minutes and try again.', 429, 'RATE_LIMITED')

    const [saved] = await db.insert(contactSubmissions).values({
      name, email, phone: phone || null, company: company || null, orderNumber: orderNumber || null,
      enquiryType, subject, message, ipHash, userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
    }).returning({ id: contactSubmissions.id })
    submissionId = saved.id

    const settings = await loadStoreSettings()
    const recipient = settings.storeEmail || process.env.CONTACT_TO_EMAIL?.trim() || process.env.CONTACT_FALLBACK_EMAIL?.trim()
    if (!recipient) throw new Error('Contact recipient is not configured.')
    await sendContactEmail({ id: saved.id, name, email, phone, company, orderNumber, enquiryType, subject, message, recipient })
    await db.update(contactSubmissions).set({ emailStatus: 'sent', updatedAt: new Date() }).where(eq(contactSubmissions.id, saved.id))
    return NextResponse.json({ data: { id: saved.id, message: 'Thanks — your enquiry has been sent.' } }, { status: 201 })
  } catch (error) {
    if (submissionId) {
      await db.update(contactSubmissions).set({ emailStatus: 'failed', emailError: error instanceof Error ? error.message.slice(0, 2000) : 'Unknown mail error', updatedAt: new Date() }).where(eq(contactSubmissions.id, submissionId)).catch(() => undefined)
    }
    if (!(error instanceof ContactError)) console.error('Contact submission failed', { submissionId, error })
    const status = error instanceof ContactError ? error.status : submissionId ? 502 : 500
    const message = error instanceof ContactError ? error.message : submissionId
      ? 'Your enquiry was saved, but email delivery failed. Please contact us directly if it is urgent.'
      : 'Your enquiry could not be saved. Please contact us directly.'
    return NextResponse.json({ error: { code: error instanceof ContactError ? error.code : submissionId ? 'EMAIL_DELIVERY_FAILED' : 'CONTACT_FAILED', message, submissionId } }, { status })
  }
}
