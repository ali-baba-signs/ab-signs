export function cleanPlainText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength)
}

/** Normalizes Australian geographic and mobile numbers to E.164. */
export function normalizeAustralianPhone(value: unknown, required = false) {
  const raw = cleanPlainText(value, 30)
  if (!raw) {
    if (required) throw new Error('Enter a valid Australian phone number.')
    return ''
  }
  if (!/^\+?[0-9 ()-]+$/.test(raw) || (raw.includes('+') && !raw.startsWith('+'))) throw new Error('Phone numbers may contain digits and a leading + only.')
  const digits = raw.replace(/\D/g, '')
  if (/^0[234578]\d{8}$/.test(digits)) return `+61${digits.slice(1)}`
  if (raw.startsWith('+') && /^61[234578]\d{8}$/.test(digits)) return `+${digits}`
  throw new Error('Enter a 10-digit Australian number or a +61 country-format number.')
}

export function phoneInputCharacters(value: string) {
  const filtered = value.replace(/[^\d+]/g, '')
  const normalized = filtered.startsWith('+') ? `+${filtered.slice(1).replace(/\+/g, '')}` : filtered.replace(/\+/g, '')
  return normalized.slice(0, 12)
}
