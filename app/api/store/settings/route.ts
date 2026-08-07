import { NextResponse } from 'next/server'
import { loadStoreSettings } from '@/lib/store/load-settings'

export async function GET() {
  try {
    const settings = await loadStoreSettings()
    return NextResponse.json({ data: { currency: settings.currency, taxRate: settings.taxRate, shippingCost: settings.shippingCost, freeShippingThreshold: settings.freeShippingThreshold, allowGuestCheckout: settings.allowGuestCheckout, paymentTestMode: settings.paymentTestMode } })
  } catch (error) {
    console.error('Public store settings load failed', error)
    return NextResponse.json({ error: { code: 'SETTINGS_UNAVAILABLE', message: 'Checkout settings are temporarily unavailable.' } }, { status: 503 })
  }
}
