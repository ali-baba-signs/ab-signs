import { NextResponse } from 'next/server'
import { loadStoreSettings } from '@/lib/store/load-settings'

export async function GET() {
  try {
    const settings = await loadStoreSettings()
    return NextResponse.json({ data: {
      storeName: settings.storeName,
      storeEmail: settings.storeEmail,
      storePhone: settings.storePhone,
      secondaryEmail: settings.secondaryEmail,
      secondaryPhone: settings.secondaryPhone,
      address: settings.address,
      businessHours: settings.businessHours,
      locations: settings.locations.filter((location) => location.enabled).sort((a, b) => a.displayOrder - b.displayOrder),
      socialLinks: settings.socialLinks.filter((link) => link.enabled).sort((a, b) => a.displayOrder - b.displayOrder),
      currency: settings.currency,
      taxRate: settings.taxRate,
      shippingCost: settings.shippingCost,
      freeShippingThreshold: settings.freeShippingThreshold,
      bannerShippingBands: settings.bannerShippingBands,
      allowGuestCheckout: settings.allowGuestCheckout,
      paymentTestMode: settings.paymentTestMode,
      termsUrl: settings.termsUrl,
      privacyUrl: settings.privacyUrl,
    } })
  } catch (error) {
    console.error('Public store settings load failed', error)
    return NextResponse.json({ error: { code: 'SETTINGS_UNAVAILABLE', message: 'Checkout settings are temporarily unavailable.' } }, { status: 503 })
  }
}
