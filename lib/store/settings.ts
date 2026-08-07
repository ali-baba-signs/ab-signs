import 'server-only'

export interface StoreSettingsValues {
  storeName: string
  storeEmail: string
  storePhone: string
  address: string
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
  storeEmail: 'support@alibabasigns.com',
  storePhone: '',
  address: '',
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
  return {
    storeName: text('storeName', 255, true),
    storeEmail: email,
    storePhone: text('storePhone', 30),
    address: text('address', 1000),
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
    payments: {
      testMode: settings.paymentTestMode,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
      paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    },
  }
}
