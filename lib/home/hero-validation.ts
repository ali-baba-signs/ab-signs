import { normalizeHeroStyle, type HeroStyleConfig } from '@/lib/home/hero-style'

export interface HeroInput {
  desktopAssetId: string
  mobileAssetId: string | null
  title: string | null
  description: string | null
  eyebrow: string | null
  buttonLabel: string | null
  buttonUrl: string | null
  altText: string
  horizontalAlignment: 'left' | 'center' | 'right'
  verticalAlignment: 'top' | 'middle' | 'bottom'
  styleConfig: HeroStyleConfig
  featured: boolean
  enabled: boolean
  displayOrder: number
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const horizontal = new Set(['left', 'center', 'right'])
const vertical = new Set(['top', 'middle', 'bottom'])

function optionalText(value: unknown, max: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

function validButtonUrl(value: string | null) {
  if (!value) return null
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null
  } catch { return null }
}

export function validateHeroInput(value: unknown): HeroInput {
  const input = value as Record<string, unknown>
  const desktopAssetId = typeof input.desktopAssetId === 'string' ? input.desktopAssetId : ''
  const mobileAssetId = typeof input.mobileAssetId === 'string' && input.mobileAssetId ? input.mobileAssetId : null
  if (!uuid.test(desktopAssetId) || (mobileAssetId && !uuid.test(mobileAssetId))) throw new Error('Select valid desktop and mobile hero assets.')
  const altText = typeof input.altText === 'string' ? input.altText.trim().slice(0, 255) : ''
  if (altText.length < 2) throw new Error('Image alt text is required.')
  const buttonLabel = optionalText(input.buttonLabel, 120)
  const rawUrl = optionalText(input.buttonUrl, 1000)
  const buttonUrl = validButtonUrl(rawUrl)
  if ((buttonLabel && !buttonUrl) || (!buttonLabel && rawUrl)) throw new Error('A hero button needs both a valid label and an internal or HTTP(S) URL.')
  const displayOrder = Number(input.displayOrder)
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 10000) throw new Error('Hero display order must be a whole number between 0 and 10000.')
  const horizontalAlignment = horizontal.has(String(input.horizontalAlignment)) ? input.horizontalAlignment as HeroInput['horizontalAlignment'] : 'left'
  const verticalAlignment = vertical.has(String(input.verticalAlignment)) ? input.verticalAlignment as HeroInput['verticalAlignment'] : 'middle'
  return { desktopAssetId, mobileAssetId, title: optionalText(input.title, 255), description: optionalText(input.description, 2000), eyebrow: optionalText(input.eyebrow, 255), buttonLabel, buttonUrl, altText, horizontalAlignment, verticalAlignment, styleConfig: normalizeHeroStyle(input.styleConfig), featured: input.featured !== false, enabled: input.enabled !== false, displayOrder }
}
