export const AUSTRALIAN_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const
export type AustralianState = typeof AUSTRALIAN_STATES[number]

const POSTCODE_RANGES: Record<AustralianState, Array<[number, number]>> = {
  NSW: [[1000, 2599], [2619, 2899], [2921, 2999]],
  ACT: [[200, 299], [2600, 2618], [2900, 2920]],
  VIC: [[3000, 3999], [8000, 8999]],
  QLD: [[4000, 4999], [9000, 9999]],
  SA: [[5000, 5999]],
  WA: [[6000, 6999]],
  TAS: [[7000, 7999]],
  NT: [[800, 999]],
}

export interface AustralianAddressInput {
  suburb?: unknown
  city?: unknown
  state?: unknown
  region?: unknown
  postalCode?: unknown
  country?: unknown
}

export function validateAustralianLocation(input: AustralianAddressInput) {
  const suburb = String(input.suburb ?? input.city ?? '').trim().replace(/\s+/g, ' ').slice(0, 160)
  const state = String(input.state ?? input.region ?? '').trim().toUpperCase() as AustralianState
  const postalCode = String(input.postalCode ?? '').trim()
  const country = String(input.country ?? 'Australia').trim()
  if (!suburb || !/^[\p{L}\d][\p{L}\d .'-]{1,158}$/u.test(suburb)) throw new Error('Enter a valid Australian suburb.')
  if (!AUSTRALIAN_STATES.includes(state)) throw new Error('Select an Australian state or territory.')
  if (!/^\d{4}$/.test(postalCode)) throw new Error('Enter a valid four-digit Australian postcode.')
  if (!/^australia$/i.test(country)) throw new Error('Delivery is available to Australian addresses only.')
  const numeric = Number(postalCode)
  if (!POSTCODE_RANGES[state].some(([from, to]) => numeric >= from && numeric <= to)) throw new Error(`Postcode ${postalCode} does not match ${state}.`)
  return { suburb, state, postalCode, country: 'Australia' as const }
}
