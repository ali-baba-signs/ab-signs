export const SUPPORT_CATEGORIES = ['General enquiry', 'Product information', 'Custom quote', 'Artwork help', 'Order status', 'Payment issue', 'Delivery question', 'Human request', 'Complaint', 'Urgent request'] as const
export type SupportCategory = typeof SUPPORT_CATEGORIES[number]
export type SupportSource = 'Website' | 'Facebook' | 'WhatsApp'
export interface SupportSettings {
  webhookUrl: string
  businessHoursEnabled: boolean
  timezone: string
  openingDays: number[]
  openingTime: string
  closingTime: string
  businessHoursResponse: string
  afterHoursResponse: string
  notificationEmails: string[]
}
export const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
  webhookUrl: '', businessHoursEnabled: true, timezone: 'Australia/Melbourne', openingDays: [1,2,3,4,5], openingTime: '09:00', closingTime: '17:00',
  businessHoursResponse: 'Thanks for contacting Alibaba Signs. Our support team will respond shortly.',
  afterHoursResponse: 'Thanks for contacting Alibaba Signs. We have received your message. Our team will reply during business hours.',
  notificationEmails: [],
}
export const validEmail = (value: string) => value.length <= 254 && /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(value)
export function validateSupportSettings(value: unknown): SupportSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Support settings are invalid.')
  const input = { ...DEFAULT_SUPPORT_SETTINGS, ...value } as Record<string, unknown>
  const text = (key: string, max: number) => { const v = input[key]; if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error(`Support ${key} is required and must be at most ${max} characters.`); return v.trim() }
  if(typeof input.businessHoursEnabled !== 'boolean') throw new Error('Support business hours enabled must be true or false.')
  const timezone = text('timezone', 100)
  try { new Intl.DateTimeFormat('en', {timeZone:timezone}).format() } catch { throw new Error('Support timezone is invalid.') }
  const openingTime = text('openingTime',5), closingTime = text('closingTime',5)
  if (![openingTime,closingTime].every(v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) || openingTime === closingTime) throw new Error('Support opening and closing times must be valid and different.')
  if (!Array.isArray(input.openingDays) || input.openingDays.some(v=>!Number.isInteger(v)||Number(v)<0||Number(v)>6)) throw new Error('Support opening days are invalid.')
  if (input.businessHoursEnabled !== false && !input.openingDays.length) throw new Error('At least one support opening day is required.')
  if (!Array.isArray(input.notificationEmails) || input.notificationEmails.length>20 || input.notificationEmails.some(v=>typeof v!=='string'||!validEmail(v.trim()))) throw new Error('Support notification emails must contain up to 20 valid email addresses.')
  const webhookUrl = typeof input.webhookUrl === 'string' ? input.webhookUrl.trim() : ''
  if (webhookUrl) { try { const url=new URL(webhookUrl); if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.port && url.port!=='443') throw new Error() } catch {throw new Error('Support webhook URL must be HTTPS without credentials, query parameters, or a custom port.')} }
  return {webhookUrl, businessHoursEnabled:input.businessHoursEnabled!==false, timezone, openingDays:[...new Set(input.openingDays as number[])].sort(), openingTime, closingTime, businessHoursResponse:text('businessHoursResponse',2000), afterHoursResponse:text('afterHoursResponse',2000), notificationEmails:[...new Set((input.notificationEmails as string[]).map(v=>v.trim().toLowerCase()))]}
}
export function supportAvailability(settings: SupportSettings, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:settings.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now)
  const part=(key:string)=>parts.find(p=>p.type===key)?.value || ''
  const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(part('weekday'))
  const minute=Number(part('hour'))*60+Number(part('minute'))
  const minutes=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3))
  const open=minutes(settings.openingTime),close=minutes(settings.closingTime)
  const within = open<close ? settings.openingDays.includes(day)&&minute>=open&&minute<close : settings.openingDays.includes(day)&&minute>=open || settings.openingDays.includes((day+6)%7)&&minute<close
  const isBusinessHours = !settings.businessHoursEnabled || within
  return {isBusinessHours, timezone:settings.timezone, response:isBusinessHours?settings.businessHoursResponse:settings.afterHoursResponse}
}
