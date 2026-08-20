import 'server-only'
import { normalizeCouponCode } from '@/lib/coupons/engine'

export type CouponAdminInput = {
  code: string; description: string | null; discountType: 'percent' | 'fixed'; discountValue: string; active: boolean
  startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; perCustomerUsageLimit: number | null
  minimumSubtotal: string | null; maxDiscountAmount: string | null; visibility: 'private' | 'public' | 'customer_specific'
}

function optionalWhole(value: unknown, label: string) {
  if (value === '' || value === null || value === undefined) return null
  const result = Number(value)
  if (!Number.isInteger(result) || result < 1) throw new Error(`${label} must be a positive whole number.`)
  return result
}

function optionalAmount(value: unknown, label: string) {
  if (value === '' || value === null || value === undefined) return null
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0) throw new Error(`${label} must be a valid amount.`)
  return result.toFixed(2)
}

export function parseCouponAdminInput(body: Record<string, unknown>): CouponAdminInput {
  const discountType = body.discountType === 'percent' || body.discountType === 'fixed' ? body.discountType : null
  const discountValue = Number(body.discountValue)
  if (!discountType || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100)) throw new Error('Enter a valid discount.')
  const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null
  const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null
  if ((startsAt && Number.isNaN(startsAt.valueOf())) || (endsAt && Number.isNaN(endsAt.valueOf())) || (startsAt && endsAt && endsAt <= startsAt)) throw new Error('End date must be after the start date.')
  const visibility = ['private', 'public', 'customer_specific'].includes(String(body.visibility)) ? String(body.visibility) as CouponAdminInput['visibility'] : 'private'
  return {
    code: normalizeCouponCode(body.code), description: typeof body.description === 'string' ? body.description.trim().slice(0, 3000) || null : null,
    discountType, discountValue: discountValue.toFixed(2), active: body.active !== false, startsAt, endsAt,
    usageLimit: optionalWhole(body.usageLimit, 'Usage limit'), perCustomerUsageLimit: optionalWhole(body.perCustomerUsageLimit, 'Per-customer limit'),
    minimumSubtotal: optionalAmount(body.minimumSubtotal, 'Minimum subtotal'), maxDiscountAmount: optionalAmount(body.maxDiscountAmount, 'Maximum discount'), visibility,
  }
}

export function idList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}
