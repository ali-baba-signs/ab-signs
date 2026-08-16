import 'server-only'

export interface StoreLocation {
  id: string
  name: string
  address: string
  phone: string
  email: string
  businessHours: string
  mapUrl: string
  enabled: boolean
  displayOrder: number
}

export interface StoreSocialLink {
  id: string
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'linkedin' | 'youtube' | 'tiktok' | 'x' | 'other'
  url: string
  enabled: boolean
  displayOrder: number
}

export interface StoreSettingsValues {
  storeName: string
  storeEmail: string
  storePhone: string
  secondaryEmail: string
  secondaryPhone: string
  address: string
  businessHours: string
  locations: StoreLocation[]
  socialLinks: StoreSocialLink[]
  currency: string
  taxRate: number
  shippingCost: number
  freeShippingThreshold: number
  turnaroundDays: string
  footerText: string
  termsUrl: string
  privacyUrl: string
  allowGuestCheckout: boolean
  paymentTestMode: boolean
}

export const DEFAULT_STORE_SETTINGS: StoreSettingsValues = {
  storeName: 'Ali Baba Signs',
  storeEmail: 'sales@alibabasigns.com.au',
  storePhone: '04 33 88 55 79',
  secondaryEmail: '',
  secondaryPhone: '',
  address: 'Perth, Western Australia',
  businessHours: '',
  locations: [],
  socialLinks: [],
  currency: 'AUD',
  taxRate: 10,
  shippingCost: 0,
  freeShippingThreshold: 50,
  turnaroundDays: '3-5',
  footerText: 'Custom print and signage for Australia.',
  termsUrl: '/terms-of-service',
  privacyUrl: '/privacy-policy',
  allowGuestCheckout: true,
  paymentTestMode: true,
}

function numberBetween(value: unknown, min: number, max: number, label: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error(`${label} must be between ${min} and ${max}.`)
  return Math.round(parsed * 100) / 100
}

export function validateStoreSettings(value: unknown): StoreSettingsValues {
  const input = value as Record<string, unknown>
  const text = (key: string, max: number, required = false) => {
    const result = typeof input?.[key] === 'string' ? input[key].trim().slice(0, max) : ''
    if (required && !result) throw new Error(`${key} is required.`)
    return result
  }
  const email = text('storeEmail', 255, true)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Store email is invalid.')
  const currency = text('currency', 3, true).toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter ISO code.')
  const optionalEmail = (key: string) => {
    const result = text(key, 255)
    if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new Error(`${key} is invalid.`)
    return result
  }
  const safeUrl = (raw: unknown, label: string, allowWhatsApp = false) => {
    let result = typeof raw === 'string' ? raw.trim().slice(0, 1000) : ''
    if (!result) return ''
    if (allowWhatsApp && /^\+?[\d\s().-]{7,30}$/.test(result)) result = `https://wa.me/${result.replace(/\D/g, '')}`
    else if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(result)) result = `https://${result}`
    try {
      const parsed = new URL(result)
      const allowed = parsed.protocol === 'https:' || parsed.protocol === 'http:' || (allowWhatsApp && parsed.protocol === 'whatsapp:')
      if (!allowed || !parsed.hostname && parsed.protocol !== 'whatsapp:') throw new Error()
      return parsed.toString()
    } catch { throw new Error(`${label} must be a valid web address.`) }
  }
  const locations = Array.isArray(input.locations) ? input.locations.slice(0, 20).map((item, index) => {
    const row = (item || {}) as Record<string, unknown>
    const locationEmail = typeof row.email === 'string' ? row.email.trim().slice(0, 255) : ''
    if (locationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(locationEmail)) throw new Error(`Location ${index + 1} email is invalid.`)
    return {
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 80) : `location-${index + 1}`,
      name: typeof row.name === 'string' ? row.name.trim().slice(0, 255) : '',
      address: typeof row.address === 'string' ? row.address.trim().slice(0, 1000) : '',
      phone: typeof row.phone === 'string' ? row.phone.trim().slice(0, 30) : '',
      email: locationEmail,
      businessHours: typeof row.businessHours === 'string' ? row.businessHours.trim().slice(0, 500) : '',
      mapUrl: safeUrl(row.mapUrl, `Location ${index + 1} map URL`),
      enabled: Boolean(row.enabled),
      displayOrder: Number.isFinite(Number(row.displayOrder)) ? Math.round(Number(row.displayOrder)) : index,
    }
  }).filter((location) => location.name || location.address) : []
  const validPlatforms = new Set<StoreSocialLink['platform']>(['facebook', 'instagram', 'whatsapp', 'linkedin', 'youtube', 'tiktok', 'x', 'other'])
  const socialLinks = Array.isArray(input.socialLinks) ? input.socialLinks.slice(0, 20).map((item, index) => {
    const row = (item || {}) as Record<string, unknown>
    const platform = validPlatforms.has(row.platform as StoreSocialLink['platform']) ? row.platform as StoreSocialLink['platform'] : 'other'
    return {
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 80) : `social-${index + 1}`,
      platform,
      url: safeUrl(row.url, `Social link ${index + 1}`, platform === 'whatsapp'),
      enabled: Boolean(row.enabled),
      displayOrder: Number.isFinite(Number(row.displayOrder)) ? Math.round(Number(row.displayOrder)) : index,
    }
  }).filter((link) => link.url) : []
  return {
    storeName: text('storeName', 255, true),
    storeEmail: email,
    storePhone: text('storePhone', 30),
    secondaryEmail: optionalEmail('secondaryEmail'),
    secondaryPhone: text('secondaryPhone', 30),
    address: text('address', 1000),
    businessHours: text('businessHours', 500),
    locations,
    socialLinks,
    currency,
    taxRate: numberBetween(input.taxRate, 0, 100, 'Tax rate'),
    shippingCost: numberBetween(input.shippingCost, 0, 100000, 'Shipping cost'),
    freeShippingThreshold: numberBetween(input.freeShippingThreshold, 0, 1000000, 'Free shipping threshold'),
    turnaroundDays: text('turnaroundDays', 50, true),
    footerText: text('footerText', 500),
    termsUrl: text('termsUrl', 500) || '/terms-of-service',
    privacyUrl: text('privacyUrl', 500) || '/privacy-policy',
    allowGuestCheckout: Boolean(input.allowGuestCheckout),
    paymentTestMode: Boolean(input.paymentTestMode),
  }
}

export function publicConfigurationStatus(settings: StoreSettingsValues) {
  return {
    storage: {
      provider: 'Cloudflare R2',
      configured: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_R2_BUCKET && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY && process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL),
    },
    payments: { stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) },
    email: {
      provider: 'SMTP',
      configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && (process.env.SMTP_USER || process.env.SMTP_USERNAME) && !/your-mailbox@|example\.(com|org)|placeholder/i.test(process.env.SMTP_USER || process.env.SMTP_USERNAME || '') && process.env.SMTP_PASSWORD && process.env.SMTP_FROM_EMAIL),
    },
  }
}
